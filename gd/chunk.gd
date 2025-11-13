extends Node


const OPTIMAL_NODES_PER_CHUNK = 128


# Emits when node is spawned, and it doesn't need to be a brand-new node. Some spawned nodes are the ones that are restored from culled nodes.
signal OnNodeSpawned(_coroutine)

# Emits when node is despawned, and it doesn't need to be despawned because the node is actually destroyed. E.g., the node may get culled from chunk.
signal OnNodeDespawned(_coroutine)


# Specify chunk size, in square.
var ChunkSize: float setget SetChunkSize

# Chunk render distance.
var ChunkDistance: int setget SetChunkDistance

# Hysteresis before node will be freed.
var Hysteresis: float

# Chunk directory path for storing all chunk files.
var ChunkPath: String

# In case if requested path fails (e.g., the chunk isn't loaded or generated), this root path will be preferred.
var FallbackChunkPath: String

# List of all possible resources within single file.
var ResourceIndexes: Array


# Indicates current interval.
var CurrentInterval := 0.0

# Indicates halved chunk size.
var ChunkSizeHalf: float

# Total distance of farthest spot before a chunk node will get culled.
var ChunkCullDistance: float

# Total distance of farthest spot before a chunk node will get saved to disk.
var ChunkSaveDistance: float

# List of observing nodes.
var Observings := []

# List of coroutines.
var Coroutines := []

# List of chunk claimers.
var ChunkClaimers := []

# List of all active chunks.
var CurrentChunks := {}

# List of all currently claimed chunks.
var ClaimedChunks := {}

# List of all upcoming chunks that will replace current chunks.
var UpcomingChunks := {}

# List of all culled chunks that are awaiting to be saved to disk.
var CulledChunks := {}

# List of all baked chunks by distance, to avoid recalculation.
var _BakedChunksByDistance := []

# File variables, threaded.
var _FileSem: Semaphore
var _FileMutex: Mutex
var _FileThread: Thread
var _FileIsExit := false
var _FileQueue: Array

var _DefaultNodeProcessFunc := funcref(self, "_DefaultNodeProcess")

var _KFilePath := "@a"
var _KNodeData := "@b"
var _KPosition := "@c"

var _IsInitialized := false


class FileQueue extends Reference:
	signal LoadFinished(_dat)
	var OperationType: int
	var StoredData


	func Finish(_dat):
		emit_signal("LoadFinished", _dat)


	func _init(
	_storedData,
	_op: int
	):
		StoredData = _storedData
		OperationType = _op


# Coroutine storage class.
class Coroutine extends Reference:
	var TargetNode: Node
	var ProcessFunc: FuncRef
	var DataStorage: Dictionary
	var IsDestroyed: bool = false

	var NextInterval = 0.0
	var CulledChunkPosition: Vector2
	var PositionPropertyName: String
	var PositionGetterFunctionName: String


	func _init(
	_node: Node,
	_storage: Dictionary,
	_process: FuncRef
	):
		TargetNode = _node
		DataStorage = _storage
		ProcessFunc = _process
		if _node is Node2D:
			PositionPropertyName = "position"
			PositionGetterFunctionName = "_GetNodePosition2D"
		else:
			PositionPropertyName = "position"
			PositionGetterFunctionName = "_GetNodePosition3D"


# Used for chunk claim/unclaim mechanism, to prevent existing chunks dupe/load & enhance performance.
class ChunkClaimer extends Reference:
	var PreviousCoordinate := Vector2()
	var CurrentCoordinate := Vector2()
	var Coordinate := Vector2()
	var Observing


	# Claim a new chunk location. This runs before unclaim happens.
	func Claim(
	_chunkSystem
	):
		PreviousCoordinate = CurrentCoordinate
		CurrentCoordinate = Observing.PreviousNodeInInterestCoordinate + Coordinate
		if !_chunkSystem.CurrentChunks.has(CurrentCoordinate):
			_chunkSystem.ClaimedChunks[CurrentCoordinate] = true
		_chunkSystem.UpcomingChunks[CurrentCoordinate] = true


	func _init(
	_coordinate: Vector2,
	_observing
	):
		Coordinate = _coordinate
		Observing = _observing


# Used for storing culled nodes that will be saved later.
class CulledChunk extends Reference:
	# Indicates current chunk coordinate that this object is located.
	var CurrentCoordinate: Vector2

	# List of all coroutines that will be culled.
	var Coroutines := []

	func _init(
	_pos: Vector2
	):
		CurrentCoordinate = _pos


# Used for observing point of interest for the chunk system to keep track on.
class Observing extends Reference:
	# Node (either 2D or 3D) that will be observed as point of interest to deploy chunks.
	var NodeInInterest setget SetNodeInInterest

	# Tells previous coordinate that the node in interest was in.
	var PreviousNodeInInterestCoordinate := Vector2(0.1, 0.1)

	# Function reference that's used for the node position grabbing.
	var CurrentNodeInInterestPositionGetter


	func SetNodeInInterest(
	_node: Node
	):
		NodeInInterest = _node
		CurrentNodeInInterestPositionGetter = funcref(self, "GetNodeInInterestPosition3D" if _node is Spatial else "GetNodeInInterestPosition2D")


	func GetNodeInInterestPosition3D():
		var _trans: Vector3 = NodeInInterest.position
		return Vector2(_trans.x, _trans.z)


	func GetNodeInInterestPosition2D():
		return NodeInInterest.position


	func IsPositionChanged(
	_chunkSystem
	):
		var _coordinate = _chunkSystem.CalculateChunkCoordinate(
			CurrentNodeInInterestPositionGetter.call_func()
		)
		if PreviousNodeInInterestCoordinate == _coordinate:
			return 0
		PreviousNodeInInterestCoordinate = _coordinate
		return 1


	func _init(
	_node: Node
	):
		SetNodeInInterest(_node)


func _OpenFile(
_name,
_op: int
) -> File:
	_name = str(_name).md5_text() + ".bin"
	var _path: String = ChunkPath + "/" + _name
	var _file := File.new()
	if [ File.READ_WRITE, File.READ ].has(_op):
		if !_file.file_exists(_path):
			_path = FallbackChunkPath + "/" + _name
	if _file.open(_path, _op) != OK:
		return null
	return _file


# Calculate chunk's coordinate based on specified position.
func CalculateChunkCoordinate(
_pos: Vector2
) -> Vector2:
	return Vector2(
		(_pos.x + ChunkSizeHalf) / ChunkSize,
		(_pos.y + ChunkSizeHalf) / ChunkSize
	).floor()


# Set current chunk's size.
func SetChunkSize(
_size: float
):
	ChunkSize = _size
	ChunkSizeHalf = _size / 2.0


# Set chunk distance.
func SetChunkDistance(
_dist: int
):
	var _range := range(-_dist, _dist)
	var _fChunkDistance := float(_dist)
	_BakedChunksByDistance.clear()
	for _y in _range:
		for _x in _range:
			var _vec := Vector2(_x, _y)
			if Vector2().distance_to(_vec) <= _fChunkDistance:
				_BakedChunksByDistance.push_back(_vec)
	var _observingNodes := []
	for _observing in Observings:
		_observingNodes.push_back(_observing.NodeInInterest)
	for _node in _observingNodes:
		RemoveObserving(_node)
		AddObserving(_node)
	ChunkCullDistance = _fChunkDistance + Hysteresis
	ChunkSaveDistance = ChunkCullDistance + Hysteresis
	ChunkDistance = _dist


# Add a node to be observed and has chunk algorithm tasks assigned.
func AddObserving(
_node: Node
):
	var _obs := Observing.new(_node)
	Observings.push_back(_obs)
	for _chunk in _BakedChunksByDistance:
		ChunkClaimers.push_back(ChunkClaimer.new(_chunk, _obs))


# Remove an observing node.
func RemoveObserving(
_node: Node
):
	var _i := 0
	var _observing
	while _i < Observings.size():
		var _o = Observings[_i]
		if _o.NodeInInterest == _node:
			Observings.remove(_i)
			_observing = _o
			break
		_i += 1
	if !_observing:
		#GODOG_IGNORE
		printerr("Invalid observing node: " + _node.name)
		#GODOG_IGNORE
		return
	_i = 0
	while _i < ChunkClaimers.size():
		if ChunkClaimers[_i].Observing == _observing:
			ChunkClaimers.remove(_i)
			continue
		_i += 1


# Spawn a chunk-managed node. It can be despawned by simply removing the node from its tree.
func SpawnNode(
_scn: PackedScene,
_pos, # '_pos' can be either 'Vector2' or 'Vector3'.
_data: Dictionary = {},
_definedNodeName: String = ""
) -> Coroutine:
	if _definedNodeName:
		var _node := get_node_or_null(_definedNodeName)
		if _node:
			#GODOG_IGNORE
			printerr("Node " + _definedNodeName + " already exists.")
			#GODOG_IGNORE
			for _coroutine in Coroutines:
				if _coroutine.TargetNode == _node:
					return _coroutine
			#GODOG_IGNORE
			printerr("However, it seems to be a non-chunk node.")
			#GODOG_IGNORE
			return null
	else:
		_definedNodeName = str("_", randi())
	var _node := _scn.instance()
	_node.name = _definedNodeName
	var _process := _DefaultNodeProcessFunc
	if _node.has_method("_ChunkInit"):
		_process = _node._ChunkInit()
	if !_process:
		_process = _DefaultNodeProcessFunc
	var _coroutine := Coroutine.new(_node, _data, _process)
	_node.set(_coroutine.PositionPropertyName, _pos)
	return AssignNode(_coroutine)


# Place node to the world.
func AssignNode(
_coroutine: Coroutine
) -> Coroutine:
	var _node = _coroutine.TargetNode
	_node.connect("tree_entered", self, "_OnNodeSpawned", [ _coroutine ], CONNECT_ONESHOT)
	_node.connect("tree_exited", self, "_OnNodeDespawned", [ _coroutine ], CONNECT_ONESHOT)
	if "Coroutine" in _node:
		_node.Coroutine = _coroutine
	emit_signal("OnNodeSpawned", _coroutine)
	call_deferred("add_child", _node) # Only add node via main thread.
	return _coroutine


# Properly destroys node and cell chunk to not cull.
func DestroyNode(
_coroutine: Coroutine
):
	_coroutine.IsDestroyed = true
	_coroutine.TargetNode.queue_free()


# Get node 2D position.
func _GetNodePosition2D(
_node: Node2D
) -> Vector2:
	return _node.position


# Get node 3D position in 2D top-view.
func _GetNodePosition3D(
_node: Spatial
) -> Vector2:
	var _trans := _node.position
	return Vector2(_trans.x, _trans.z)


# Emits every specified second for each chunk node.
func _OnNodeProcess(
_coroutine: Coroutine
):
	var _target := _coroutine.TargetNode
	var _farCount := 0
	var _targetCoordinate: Vector2 = CalculateChunkCoordinate(call(_coroutine.PositionGetterFunctionName, _target))
	for _observing in Observings:
		if ChunkCullDistance < _targetCoordinate.distance_to(_observing.PreviousNodeInInterestCoordinate):
			_farCount += 1
	if _farCount == Observings.size():
		_target.get_parent().remove_child(_target)
		return 0.0
	return _coroutine.ProcessFunc.call_func(_target, _coroutine.DataStorage)


# Default node process function.
func _DefaultNodeProcess(
_target: Node,
_data: Dictionary
):
	return randf()


func _OnNodeSpawned(
_coroutine: Coroutine
):
	Coroutines.push_back(_coroutine)


func _CullChunkTo(
_coroutine: Coroutine,
_culledChunks: Dictionary
):
	var _chunkCoord := CalculateChunkCoordinate(
		call(_coroutine.PositionGetterFunctionName, _coroutine.TargetNode)
	)
	if !_culledChunks.has(_chunkCoord):
		_culledChunks[_chunkCoord] = CulledChunk.new(_chunkCoord)
	_culledChunks[_chunkCoord].Coroutines.push_back(_coroutine)


# Emits when a node is despawned (via removing it from scene tree).
func _OnNodeDespawned(
_coroutine: Coroutine
):
	emit_signal("OnNodeDespawned", _coroutine)
	if !_coroutine.IsDestroyed:
		_CullChunkTo(_coroutine, CulledChunks)
	Coroutines.erase(_coroutine)


# Save all active nodes to chunks. Should only be called manually.
func SaveAll():
	var _culledChunks := {}
	for _coroutine in Coroutines:
		_CullChunkTo(_coroutine, _culledChunks)
	# Save all active nodes in chunk to file.
	_FileMutex.lock()
	for _key in _culledChunks:
		_FileQueue.push_back(FileQueue.new(_culledChunks[_key], File.WRITE))
	_FileMutex.unlock()
	_FileSem.post()


func _process(
_deltaTime: float
):
	var _chunkChanges := 0
	for _observing in Observings:
		_chunkChanges += _observing.IsPositionChanged(self)
		for _key in CulledChunks:
			if _observing.PreviousNodeInInterestCoordinate.distance_to(
				CulledChunks[_key].CurrentCoordinate
			) > ChunkSaveDistance:
				# Save all nodes in chunk to file.
				_FileMutex.lock()
				_FileQueue.push_back(FileQueue.new(CulledChunks[_key], File.WRITE))
				CulledChunks.erase(_key)
				_FileMutex.unlock()
				_FileSem.post()
				break

	if _chunkChanges:
		for _chunk in ChunkClaimers:
			_chunk.Claim(self)
		for _coord in ClaimedChunks.keys():
			# Spawn nodes from culled chunks.
			if CulledChunks.has(_coord):
				var _culledCoroutine = CulledChunks[_coord]
				var _coroutines = _culledCoroutine.Coroutines
				for _coroutine in _coroutines:
					AssignNode(_coroutine)
				CulledChunks.erase(_coord)
			else:
				# Spawn nodes from file.
				_FileMutex.lock()
				_FileQueue.push_back(FileQueue.new(_coord, File.READ))
				_FileMutex.unlock()
				_FileSem.post()

		CurrentChunks = UpcomingChunks
		UpcomingChunks = {}
		ClaimedChunks = {}

	for _ref in Coroutines:
		if CurrentInterval > _ref.NextInterval:
			_ref.NextInterval += _OnNodeProcess(_ref)
	CurrentInterval += _deltaTime


func _FileProcessThreaded():
	while true:
		_FileSem.wait() # Wait until next posts.

		_FileMutex.lock()
		var _queue: FileQueue = _FileQueue.pop_front()
		_FileMutex.unlock()

		if _queue.OperationType == File.READ:
			var _file := _OpenFile(_queue.StoredData, File.READ)
			if !_file:
				# printerr("Cannot load file '" + str(_queue.StoredData) + "'!")
				continue
			var _data = _file.get_var()
			if !(_data is Dictionary):
				continue
			for _nodeName in _data:
				var _obj: Dictionary = _data[_nodeName]
				SpawnNode(
					load(tr(_obj[_KFilePath])),
					_obj[_KPosition],
					_obj[_KNodeData],
					_nodeName
				)
			continue

		if _queue.OperationType == File.WRITE:
			var _data = {}
			var _chunk: CulledChunk = _queue.StoredData
			var _file := _OpenFile(_chunk.CurrentCoordinate, File.READ)
			if _file:
				_data = _file.get_var()
				_file.close()
				if !(_data is Dictionary):
					_data = {}
			_file = _OpenFile(_chunk.CurrentCoordinate, File.WRITE)
			var _coroutines := _chunk.Coroutines
			#GODOG_IGNORE
			if _coroutines.size() > OPTIMAL_NODES_PER_CHUNK:
				printerr(str("For optimal loading times, one chunk should never contain more than ", OPTIMAL_NODES_PER_CHUNK, " nodes, but ", _chunk.CurrentCoordinate, " has ", _coroutines.size(), " nodes."))
			#GODOG_IGNORE
			for _coroutine in _coroutines:
				var _node = _coroutine.TargetNode
				var _serial := {
					_KFilePath: tr(_node.filename), # Always translate file paths.
					_KNodeData: _coroutine.DataStorage,
					_KPosition: _node.get(_coroutine.PositionPropertyName),
				}
				_data[_node.name] = _serial
			_file.store_var(_data)
			_file.close()
			continue


# Initialise chunk system.
func Initialize(
_size: float = 16.0,
_dist: int = 16.0,
_hyst: float = 1.0,
_path: String = "res://world",
_fallbackPath: String = "res://world"
):
	if _IsInitialized:
		#GODG_IGNORE
		# Never allows repeat initialisation.
		printerr("This chunk node '" + name + "' is already initialised! Consider destroy and create a new chunk node instead.")
		#GODOG_IGNORE
		return
	_IsInitialized = true
	Hysteresis = _hyst
	ChunkPath = _path
	FallbackChunkPath = _fallbackPath
	SetChunkSize(_size)
	SetChunkDistance(_dist)
	set_process(true)


func _ready():
	set_process(false)
	_FileSem = Semaphore.new()
	_FileMutex = Mutex.new()
	_FileThread = Thread.new()
	_FileThread.start(self, "_FileProcessThreaded")


func _exit_tree():
	_FileMutex.lock()
	_FileIsExit = true
	_FileMutex.unlock()
	_FileSem.post()
	_FileThread.wait_to_finish()

extends Node


# Emits when node is spawned, and it doesn't need to be a brand-new node. Some spawned nodes are the ones that are restored from culled nodes.
signal OnNodeSpawned(_node, _data)

# Emits when node is despawned, and it doesn't need to be despawned because the node is actually destroyed. E.g., the node may get culled from chunk.
signal OnNodeDespawned(_node, _data)

var _AwaitingSpawnNodesMutex: Mutex
var _AwaitingSpawnNodes := []

var _CachedResourcesMutex: Mutex
var _CachedResources = {}
var _ChunkThread: Thread
var _ChunkMutex: Mutex
var _ChunkSem: Semaphore
var _ChunkQueue := []
var _IsExit := false

var _BakedCoords := []
var _Observings := []

var _ChunkCullDistance = 0
var _ChunkPath := ""
var _ChunkSizeHalfPx := 0.0
var _Coroutines := {}
var _CurrentInterval := 0.0

var _QueryBinds = {}
var _QueryExclusions = {}

export var _ChunkSizePx := 1024.0
export var _ChunkDistance := 4
export var _ChunkHysteresis := 2
export var _ChunkDefaultPath := "res://saves/default"
export var _DefaultCoroutineInterval := 1.0
export var _NodeSpawnFrequency := 2


# Add a node to be observed and has chunk algorithm tasks assigned.
func AddObserving(
_node: Node
):
	var _obs = _CreateObserving(_node)
	_Observings.push_back(_obs)


# Attach function binding to specified query. Functions will be called with parameters `node: Node` and `data: Dictionary`.
func BindQuery(
_functions,
_keys: Array,
_exclusions = [],
_forceUpdate = false
):
	if _functions is FuncRef:
		_functions = [ _functions ]
	var _existingFuncs = _QueryBinds[
		_Query(_keys, _exclusions, _forceUpdate)
	]
	for _func in _functions:
		_existingFuncs.push_back(_func)
	for _coroutine in _Coroutines.values():
		_UpdateQuery(_coroutine)


# Properly destroys coroutine and cell chunk to not cull.
func DestroyNode(
_node: Node
):
	for _c in _Coroutines.values():
		if _c.TargetNode == _node:
			_DestroyCoroutine(_c)
			return true
	return false


# Initialise chunk system.
func Initialize(
_path: String = ""
):
	if is_processing():
		assert(false, tr("_ChunkIsAlreadyInitialised"))
		return
	_ChunkCullDistance = _ChunkDistance + _ChunkHysteresis
	_ChunkSizeHalfPx = _ChunkSizePx / 2.0
	_ChunkPath = _path if _path else _ChunkDefaultPath

	# Calculate chunk range for fast baking
	var _range := range(-_ChunkDistance, _ChunkDistance)
	var _fChunkDistance := float(_ChunkDistance)
	for _y in _range:
		for _x in _range:
			var _vec := Vector2(_x, _y)
			if Vector2().distance_to(_vec) <= _fChunkDistance:
				_BakedCoords.push_back(_vec)

	set_process(true)
	_ChunkThread.start(self, "__Chunk_ThreadLoop")
	connect("child_entered_tree", self, "_OnNodeSpawned")
	connect("child_exiting_tree", self, "_OnNodeDespawned")


# Signals this node to be processed instantly.
func ProcessInstantly(
_node: Node
):
	var _coroutine = _Coroutines[_node.name]
	_coroutine.NextInterval = _CurrentInterval - randf() * _coroutine.Interval


# Set process interval for this node, can be as low as 0.1.
func SetInterval(
_node: Node,
_itv = 1.0
):
	_Coroutines[_node.name].Interval = min(_itv, 0.1)


# Save all loaded nodes.
func SaveAll():
	for _coroutine in _Coroutines.values():
		_CullNode(_coroutine, true)


# Spawn a chunk-managed node. It can be despawned by simply removing the node from its tree.
func SpawnNode(
_path: String,
_pos, # '_pos' can be either 'Vector2' or 'Vector3'.
_data: Dictionary = {},
_name: String = ""
):
	_AwaitingSpawnNodesMutex.lock()
	_AwaitingSpawnNodes.push_back([
		_path, _pos, _data, _name
	])
	_AwaitingSpawnNodesMutex.unlock()


# Default process function to be called for coroutines.
func _DefaultNodeProcess(
_interval: float
):
	return _DefaultCoroutineInterval


# Calculate chunk's coordinate based on specified position.
func _CalculateChunkCoordinate(
_size: float,
_half: float,
_pos: Vector2
) -> Vector2:
	return Vector2(
		(_pos.x + _half) / _size,
		(_pos.y + _half) / _size
	).floor()


# Create coroutine data structure.
func _CreateCoroutine(
_scnPath: String,
_node: Node,
_storage: Dictionary,
_isStreamed: bool,
_posGetterName: String,
_posPropName: String
):
	return {
		NextInterval = _CurrentInterval + randf(),
		IsStreamed = _isStreamed,
		BoundQueries = {},
		Interval = 1.0,

		FilePath = _scnPath,
		TargetNode = _node,
		DataStorage = _storage,
		DataStorageHash = _storage.hash(),
		PositionGetterName = _posGetterName,
		PositionPropertyName = _posPropName,
	}


# Create observing node data structure.
func _CreateObserving(
_node: Node
):
	return {
		NodeInInterest = _node,
		PositionGetter = "_GetNodePosition3D" if _node is Spatial else "_GetNodePosition2D",
		CurrentCoordinate = Vector2(0.000001, 0.000001),
	}


# Cull node to chunk thread.
func _CullNode(
_coroutine: Dictionary,
_isSaving: bool
):
	__Chunk_PushCall(File.WRITE, [ _coroutine.duplicate(true), _isSaving ])


# Destroy specified coroutine along with its assigned node.
func _DestroyCoroutine(
_coroutine: Dictionary
):
	var _node = _coroutine.TargetNode
	var _getterName = _coroutine.PositionPropertyName
	var _dict = {
		name = _node.name,
		_getterName: _node.get(_getterName),
	}
	_coroutine.TargetNode = _dict
	_node.queue_free()


# Get node 2D position.
func _GetNodePosition2D(
_node
) -> Vector2:
	return _node.position


# Get node 3D position in 2D top-view.
func _GetNodePosition3D(
_node
) -> Vector2:
	var _trans = _node.position
	return Vector2(_trans.x, _trans.z)


# Check if observing's chunk coordinate is changed.
func _IsObservingCoordinateChanged(
_observing: Dictionary
) -> bool:
	var _coordinate = _CalculateChunkCoordinate(
		_ChunkSizePx, _ChunkSizeHalfPx, call(_observing.PositionGetter, _observing.NodeInInterest)
	)
	if _observing.CurrentCoordinate == _coordinate:
		return false
	_observing.CurrentCoordinate = _coordinate
	return true


# This will be called when node gets culled.
func _OnNodeDespawned(
_node: Node
):
	var _name = _node.name
	var _coroutine = _Coroutines[_name]
	var _data = _coroutine.DataStorage
	emit_signal("OnNodeDespawned", _node, _data)
	_Coroutines.erase(_node.name)
	if _coroutine.TargetNode is Dictionary && !_coroutine.IsStreamed:
		return
	_CullNode(_coroutine, false)


# Emits every specified second for each chunk node.
func _OnNodeProcess(
_coroutine: Dictionary
):
	var _farCount := 0
	var _target = _coroutine.TargetNode
	var _targetCoordinate: Vector2 = _CalculateChunkCoordinate(_ChunkSizePx, _ChunkSizeHalfPx, call(_coroutine.PositionGetterName, _target))
	for _observing in _Observings:
		if _ChunkCullDistance < _targetCoordinate.distance_to(_observing.CurrentCoordinate):
			_farCount += 1
	if _farCount == _Observings.size():
		remove_child(_target)
		return
	var _storage = _coroutine.DataStorage
	var _beforeProcess = _storage.keys().hash()
	if _beforeProcess != _coroutine.DataStorageHash:
		_coroutine.DataStorageHash = _beforeProcess
		_UpdateQuery(_coroutine)
	for _key in _coroutine.BoundQueries.keys():
		for _func in _QueryBinds[_key]:
			_func.call_func(_target, _storage, _CurrentInterval)
	var _afterProcess = _storage.keys().hash()
	if _beforeProcess != _afterProcess:
		_coroutine.DataStorageHash = _afterProcess
		_UpdateQuery(_coroutine)


# When node gets spawned, this will be called.
func _OnNodeSpawned(
_node: Node
):
	var _coroutine = _Coroutines[_node.name]
	var _data = _coroutine.DataStorage
	if "_ChunkDefaultData" in _node:
		for _res in _node._ChunkDefaultData:
			var _defaults = _res.Defaults
			for _key in _defaults:
				if !_data.has(_key):
					_data[_key] = _defaults[_key]
	if "_ChunkNodeInterval" in _node:
		_coroutine.Interval = _node._ChunkNodeInterval
	if _node.has_method("_ChunkReady"):
		_node._ChunkReady(self, _data)
	_coroutine.NextInterval += _coroutine.Interval
	_UpdateQuery(_coroutine)
	emit_signal("OnNodeSpawned", _node, _data)


# Perform file open operation.
func _OpenFile(
_name,
_op: int
) -> File:
	_name = str(_name).md5_text() + ".bin"
	var _path: String = _ChunkPath + "/" + _name
	var _file := File.new()
	if [ File.READ_WRITE, File.READ ].has(_op):
		if !_file.file_exists(_path):
			_path = _ChunkDefaultPath + "/" + _name
	if _file.open(_path, _op) != OK:
		return null
	return _file


# Build query.
func _Query(
_keys: Array,
_exclusions = [],
_forceUpdate = false
):
	_keys.sort()
	var _psKeys = PoolStringArray(_keys)
	if !_QueryBinds.has(_psKeys) || _forceUpdate:
		_exclusions.sort()
		_QueryBinds[_psKeys] = []
		_QueryExclusions[_psKeys] = PoolStringArray(_exclusions)
		for _coroutine in _Coroutines.values():
			_UpdateQuery(_coroutine)
	return _psKeys


func _SpawnNode(
_path: String,
_pos, # '_pos' can be either 'Vector2' or 'Vector3'.
_data: Dictionary = {},
_name: String = ""
):
	var _isStreamed = (_name != "")
	if _isStreamed:
		if _Coroutines.has(_name):
			# FIX: For some reason, thread still spills out loaded nodes, and this code block must exist. DO NOT REMOVE.
			#GODOG_IGNORE
			printerr(_name + " already exists.")
			#GODOG_IGNORE
			return
	else:
		_name = str("_", randi())
		while _Coroutines.has(_name):
			_name = str("_", randi())
	if !_CachedResources.has(_path):
		_CachedResources[_path] = load(_path)
	_CachedResourcesMutex.lock()
	var _node = _CachedResources[_path].instance()
	_CachedResourcesMutex.unlock()
	_node.name = _name
	var _posGetterName
	var _posPropName
	if _node is Node2D:
		_posGetterName = "_GetNodePosition2D"
		_posPropName = "position"
	elif _node is Spatial:
		_posGetterName = "_GetNodePosition3D"
		_posPropName = "position"
	_node.set(_posPropName, _pos)
	var _coroutine = _CreateCoroutine(_path, _node, _data, _isStreamed, _posGetterName, _posPropName)
	_Coroutines[_name] = _coroutine
	add_child(_node)


func _UpdateQuery(
_coroutine: Dictionary
):
	var _storage = _coroutine.DataStorage
	var _bound = _coroutine.BoundQueries
	for _query in _QueryBinds:
		var _exists = true
		for _key in _query:
			if _key in _storage:
				continue
			_exists = false
			break
		for _key in _QueryExclusions[_query]:
			if _key in _storage:
				_exists = false
				break
		if _exists:
			_bound[_query] = true
		else:
			_bound.erase(_query)


# Submit RPC call to chunk thread.
func __Chunk_PushCall(
_opType: int,
_data = null
):
	_ChunkMutex.lock()
	_ChunkQueue.push_back([ _opType, _data ])
	_ChunkMutex.unlock()
	_ChunkSem.post()


func __Chunk_ThreadLoop():
	var _kOp = 0
	var _kData = 1
	var _kCoroutine = 0
	var _kIsFromSaving = 1

	var _kFilePath := 0
	var _kNodeData := 1
	var _kPosition := 2

	# Full copy variables for memory safety
	var _path = _ChunkPath
	var _size = _ChunkSizePx
	var _half = _ChunkSizeHalfPx
	var _dist = _ChunkDistance
	var _hyst = _ChunkHysteresis

	var _bakedCoords = _BakedCoords
	var _isResourceCached = {}
	var _loadedNodes = {}
	_BakedCoords = []

	while true:
		# Wait for main thread
		_ChunkSem.wait()

		# Pop ONLY one command
		_ChunkMutex.lock()
		if _IsExit:
			_ChunkMutex.unlock()
			break
		var _cmd = _ChunkQueue.pop_front()
		_ChunkMutex.unlock()

		if _cmd[_kOp] == File.READ:
			# Calculate chunks to be loaded
			var _observePoint = _cmd[_kData]
			var _chunkCoords = _bakedCoords.duplicate()
			var _ci = 0
			var _csize = _chunkCoords.size()
			while _ci < _csize:
				_chunkCoords[_ci] += _observePoint
				_ci += 1
			
			# Spawn all nodes from chunk file
			for _chunkCoord in _chunkCoords:
				var _file := _OpenFile(_chunkCoord, File.READ)
				if !_file:
					continue
				var _data = _file.get_var()
				if !(_data is Dictionary):
					continue
				for _nodeName in _data:
					if _loadedNodes.has(_nodeName):
						continue
					var _obj: Dictionary = _data[_nodeName]
					var _resPath = tr(_obj[_kFilePath])
					if !_isResourceCached.has(_resPath):
						_CachedResourcesMutex.lock()
						_CachedResources[_resPath] = load(_resPath)
						_CachedResourcesMutex.unlock()
						_isResourceCached[_resPath] = true
					SpawnNode(
						_resPath,
						_obj[_kPosition],
						_obj[_kNodeData],
						_nodeName
					)
					_loadedNodes[_nodeName] = true
			continue
		
		if _cmd[_kOp] == File.WRITE:
			var _data = {}
			var _args = _cmd[_kData]
			var _coroutine = _args[_kCoroutine]
			var _destroyAfter = !_args[_kIsFromSaving]

			# Calculate node position & coord
			var _node = _coroutine.TargetNode
			var _nodeName = _node.name
			var _position = call(_coroutine.PositionGetterName, _node)
			var _coordinate = _CalculateChunkCoordinate(_size, _half, _position)

			# Read previously existing data
			var _read = _OpenFile(_coordinate, File.READ)
			if _read:
				var _stream = _read.get_var()
				_read.close()
				if _stream is Dictionary:
					_data = _stream

			# Write data to disk
			if _node is Dictionary:
				_data.erase(_nodeName)
				_loadedNodes.erase(_nodeName)
			else:
				var _serial := {
					_kFilePath: tr(_coroutine.FilePath), # Always translate file paths.
					_kNodeData: _coroutine.DataStorage,
					_kPosition: _node.get(_coroutine.PositionPropertyName),
				}
				if _destroyAfter:
					_node.call_deferred("queue_free")
					_loadedNodes.erase(_nodeName)
				_data[_nodeName] = _serial
			var _file = _OpenFile(_coordinate, File.WRITE)
			_file.store_var(_data)
			_file.close()
			continue


func _ready():
	_AwaitingSpawnNodesMutex = Mutex.new()
	_CachedResourcesMutex = Mutex.new()
	_ChunkThread = Thread.new()
	_ChunkMutex = Mutex.new()
	_ChunkSem = Semaphore.new()
	set_process(false)


func _process(
_deltaTime: float
):
	_AwaitingSpawnNodesMutex.lock()
	for _x in range(_NodeSpawnFrequency):
		var _args = _AwaitingSpawnNodes.pop_front()
		if _args:
			call_deferred("_SpawnNode", _args[0], _args[1], _args[2], _args[3])
	_AwaitingSpawnNodesMutex.unlock()

	for _observing in _Observings:
		if _IsObservingCoordinateChanged(_observing):
			__Chunk_PushCall(File.READ, _observing.CurrentCoordinate)
	for _ref in _Coroutines.values():
		while _CurrentInterval > _ref.NextInterval:
			_ref.NextInterval += _ref.Interval
			_OnNodeProcess(_ref)
	_CurrentInterval += _deltaTime


func _exit_tree():
	SaveAll()
	_ChunkMutex.lock()
	_IsExit = true
	_ChunkMutex.unlock()
	_ChunkSem.post()
	_ChunkThread.wait_to_finish()

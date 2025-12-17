extends Node


const THREAD_RES_LOAD = 2398420123

# Notifies when both saved chunks and default chunks do not exist.
signal OnEmptyChunk(_coord)

# Emits when node is spawned, and it doesn't need to be a brand-new node. Some spawned nodes are the ones that are restored from culled nodes.
signal OnNodeSpawned(_node, _data)

# Emits when node is despawned, and it doesn't need to be despawned because the node is actually destroyed. E.g., the node may get culled from chunk.
signal OnNodeDespawned(_node, _data)

var _AwaitingSpawnNodesMutex: Mutex
var _AwaitingSpawnNodes := []

var _ChunkThread: Thread
var _ChunkMutex: Mutex
var _ChunkSem: Semaphore
var _ChunkQueue := []
var _IsExit := false

var _BakedCoords := []
var _Observings := []
var _TotalObservingDistance := 0.0

var _ChunkCullDistance = 0
var _ChunkPath := ""
var _ChunkSizeHalfPx := 0.0
var _Coroutines := {}
var _CurrentInterval := 0.0

var _QueryBinds_OnEntry = {}
var _QueryBinds_OnExit = {}
var _QueryBinds = {}

var _QueryMaskKeys = {}
var _QueryMaskNextKey = 1

export var _ChunkSizePx := 1024.0
export var _ChunkDistance := 4
export var _ChunkHysteresis := 2
export var _ChunkDefaultPath := "res://saves/default"
export var _DefaultCoroutineInterval := 0.2
export var _NodeSpawnFrequency := 3


class DataInterface extends Reference:
	var Masking = 0;
	var Referencing = {}
	var _ChunkNode = Engine.get_meta("ChunkNode")
	func _init(_dict: Dictionary):
		Referencing = _dict
		for _key in _dict:
			Masking |= _ChunkNode._QueryMask(_key)
	func GetValue(_key: String):
		return Referencing.get(_key)
	func HasValue(_key: String):
		return Referencing.has(_key)
	func Properties():
		return Referencing.keys()
	func SetDefault(_key: String, _value):
		if !Referencing.has(_key):
			Masking |= _ChunkNode._QueryMask(_key)
			Referencing[_key] = _value
		return Referencing[_key]
	func SetValue(_key: String, _value):
		Masking |= _ChunkNode._QueryMask(_key)
		Referencing[_key] = _value
	func Remove(_key: String):
		Referencing.erase(_key)
		Masking &= ~_ChunkNode._QueryMask(_key)


# Add a node to be observed and has chunk algorithm tasks assigned.
func AddObserving(
_node: Node
):
	_Observings.push_back(_CreateObserving(_node))
	_CalculateTotalObservingDistance()


# Attach function binding to specified query to be called when node is spawned. Functions will be called with parameters `node: Node` and `data: Dictionary`.
func BindQueryOnExit(
_functions,
_keys: Array
):
	_BindQuery(_QueryBinds_OnExit, _functions, _keys)


# Attach function binding to specified query to be called when node is spawned. Functions will be called with parameters `node: Node` and `data: Dictionary`.
func BindQueryOnEntry(
_functions,
_keys: Array
):
	_BindQuery(_QueryBinds_OnEntry, _functions, _keys)


# Attach function binding to specified query. Functions will be called with parameters `node: Node` and `data: Dictionary`.
func BindQuery(
_functions,
_keys: Array
):
	_BindQuery(_QueryBinds, _functions, _keys)


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
	_CalculateTotalObservingDistance()

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


# Signals this node to be processed nearly instantly (often after current frame within this frame).
func ProcessInstantly(
_node: Node
):
	var _coroutine = _Coroutines[_node.name]
	_coroutine.NextInterval = _CurrentInterval - randf() * get_process_delta_time()


# Remove specifed node from being observed by chunuk.
func RemoveObserving(
_node: Node
):
	for _obs in _Observings:
		if _obs.NodeInInterest == _node:
			_Observings.erase(_obs)
			_CalculateTotalObservingDistance()
			break


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
	__Chunk_PushCall(THREAD_RES_LOAD, [ _path, _pos, _data, _name ])


func _BindQuery(
_to: Dictionary,
_functions,
_keys: Array
):
	if _functions is FuncRef:
		_functions = [ _functions ]
	var _existingFuncs = _to[_Query(_keys)]
	for _func in _functions:
		_existingFuncs.push_back(_func)
	for _coroutine in _Coroutines.values():
		_UpdateQuery(_coroutine)


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


func _CalculateTotalObservingDistance():
	_TotalObservingDistance = _Observings.size() * _ChunkCullDistance


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
		BoundQueryMask = 0,
		Interval = _DefaultCoroutineInterval,

		FilePath = _scnPath,
		TargetNode = _node,
		DataStorage = DataInterface.new(_storage),
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


# Default process function to be called for coroutines.
func _DefaultNodeProcess(
_interval: float
):
	return _DefaultCoroutineInterval


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


func _NotifyEmptyChunk(
_coord: Vector2
):
	emit_signal("OnEmptyChunk", _coord)


# This will be called when node gets culled.
func _OnNodeDespawned(
_node: Node
):
	var _name = _node.name
	if !_Coroutines.has(_name):
		return
	var _coroutine = _Coroutines[_name]
	if _coroutine.TargetNode is Dictionary && !_coroutine.IsStreamed:
		return
	var _data = _coroutine.DataStorage
	for _key in _coroutine.BoundQueries.keys():
		for _func in _QueryBinds_OnExit[_key]:
			_func.call_func(_node, _data, _CurrentInterval)
	emit_signal("OnNodeDespawned", _node, _data)
	_Coroutines.erase(_node.name)
	_CullNode(_coroutine, false)


# Emits every specified second for each chunk node.
func _OnNodeProcess(
_coroutine: Dictionary
):
	var _farCount := 0.0
	var _target = _coroutine.TargetNode
	var _targetCoordinate: Vector2 = _CalculateChunkCoordinate(_ChunkSizePx, _ChunkSizeHalfPx, call(_coroutine.PositionGetterName, _target))
	for _observing in _Observings:
		_farCount += _targetCoordinate.distance_to(_observing.CurrentCoordinate)
	if _farCount >= _TotalObservingDistance:
		remove_child(_target)
		return
	var _storage = _coroutine.DataStorage
	if _storage.Masking != _coroutine.BoundQueryMask:
		_coroutine.BoundQueryMask = _storage.Masking
		_UpdateQuery(_coroutine)
	for _key in _coroutine.BoundQueries:
		for _func in _QueryBinds[_key]:
			_func.call_func(_target, _storage, _CurrentInterval)


# When node gets spawned, this will be called.
func _OnNodeSpawned(
_node: Node
):
	var _name = _node.name
	if !_Coroutines.has(_name):
		return
	var _coroutine = _Coroutines[_name]
	var _data = _coroutine.DataStorage
	if "_ChunkDefaultData" in _node:
		for _res in _node._ChunkDefaultData:
			var _defaults = _res.Defaults
			for _key in _defaults:
				_data.SetDefault(_key, _defaults[_key])
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
	if _op == File.READ:
		if !_file.file_exists(_path):
			_path = _ChunkDefaultPath + "/" + _name
	if _file.open(_path, _op) != OK:
		return null
	return _file


# Build query.
func _Query(
_keys: Array
):
	var _mask = 0
	for _key in _keys:
		_mask |= _QueryMask(_key)
	if !_QueryBinds.has(_mask):
		_QueryBinds[_mask] = []
		_QueryBinds_OnExit[_mask] = []
		_QueryBinds_OnEntry[_mask] = []
		for _coroutine in _Coroutines.values():
			_UpdateQuery(_coroutine)
	return _mask


func _QueryMask(
_key: String
):
	if !_QueryMaskKeys.has(_key):
		_QueryMaskKeys[_key] = _QueryMaskNextKey
		_QueryMaskNextKey <<= 1
	return _QueryMaskKeys[_key]


func _SpawnNode(
_scn: PackedScene,
_isStreamed: bool,
_path: String,
_pos, # '_pos' can be either 'Vector2' or 'Vector3'.
_data: Dictionary,
_name: String
):
	var _node = _scn.instance()
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
	var _mask = _coroutine.BoundQueryMask
	var _bound = _coroutine.BoundQueries
	var _node = _coroutine.TargetNode
	for _query in _QueryBinds:
		if _mask & _query == _query:
			if !_bound.has(_query):
				for _func in _QueryBinds_OnEntry[_query]:
					_func.call_func(_node, _storage, _CurrentInterval)
				_bound[_query] = true
		else:
			if _bound.has(_query):
				for _func in _QueryBinds_OnExit[_query]:
					_func.call_func(_node, _storage, _CurrentInterval)
				_bound.erase(_query)


# Submit RPC call to chunk thread.
func __Chunk_PushCall(
_opType: int,
_data = null
):
	while _ChunkMutex.try_lock(): pass
	_ChunkQueue.push_back([ _opType, _data ])
	_ChunkMutex.unlock()
	_ChunkSem.post()


func __Chunk_ThreadLoop():
	var _kOp = 0
	var _kData = 1
	var _kCoroutine = 0
	var _kIsFromSaving = 1

	var _kSpawnNodePath = 0
	var _kSpawnNodePos = 1
	var _kSpawnNodeData = 2
	var _kSpawnNodeName = 3

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
	var _loadedNodes = {}
	_BakedCoords = []

	while true:
		# Wait for main thread
		_ChunkSem.wait()

		# Pop ONLY one command
		while _ChunkMutex.try_lock(): pass
		if _IsExit:
			_ChunkMutex.unlock()
			break
		var _cmd = _ChunkQueue.pop_front()
		_ChunkMutex.unlock()

		if _cmd[_kOp] == THREAD_RES_LOAD:
			var _args = _cmd[_kData]
			var _res = load(_args[_kSpawnNodePath])
			if !_res:
				continue
			var _nodeName = _args[_kSpawnNodeName]
			var _isStreamed = (_nodeName != "")
			if _isStreamed:
				if _loadedNodes.has(_nodeName):
					continue
			else:
				_nodeName = str("_", randi())
				while _loadedNodes.has(_nodeName):
					_nodeName = str("_", randi())
			_loadedNodes[_nodeName] = true
			_args[_kSpawnNodeName] = _nodeName
			_args.push_front(_isStreamed)
			_args.push_front(_res)
			while _AwaitingSpawnNodesMutex.try_lock(): pass
			_AwaitingSpawnNodes.push_back(_args)
			_AwaitingSpawnNodesMutex.unlock()
			continue

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
					call_deferred("_NotifyEmptyChunk", _chunkCoord)
					continue
				var _data = _file.get_var()
				if !(_data is Dictionary):
					continue
				for _nodeName in _data:
					var _obj: Dictionary = _data[_nodeName]
					var _tr = tr(_obj[_kFilePath])
					if "@" in _tr:
						_tr = _obj[_kFilePath]
					SpawnNode(
						_tr,
						_obj[_kPosition],
						_obj[_kNodeData],
						_nodeName
					)
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
					_kNodeData: _coroutine.DataStorage.Referencing,
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
	_ChunkThread = Thread.new()
	_ChunkMutex = Mutex.new()
	_ChunkSem = Semaphore.new()
	set_process(false)


func _process(
_deltaTime: float
):
	for _x in range(_NodeSpawnFrequency):
		while _AwaitingSpawnNodesMutex.try_lock(): pass
		var _args = _AwaitingSpawnNodes.pop_front()
		_AwaitingSpawnNodesMutex.unlock()
		if _args:
			_SpawnNode(_args[0], _args[1], _args[2], _args[3], _args[4], _args[5])

	for _observing in _Observings:
		if _IsObservingCoordinateChanged(_observing):
			__Chunk_PushCall(File.READ, _observing.CurrentCoordinate)

	for _ref in _Coroutines.values():
		while _CurrentInterval > _ref.NextInterval:
			_ref.NextInterval += _ref.Interval
			_OnNodeProcess(_ref)
	_CurrentInterval += _deltaTime


func _enter_tree():
	Engine.set_meta("ChunkNode", self)


func _exit_tree():
	SaveAll()
	while _ChunkMutex.try_lock(): pass
	_IsExit = true
	_ChunkMutex.unlock()
	_ChunkSem.post()
	_ChunkThread.wait_to_finish()
	Engine.remove_meta("ChunkNode")

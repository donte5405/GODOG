extends Node


# We need to spread out File read & write to reduce thread locking.


var _HeadQueue: StorageQueue
var _TailQueue: StorageQueue
var _QueueSize := 0


class StorageQueue extends Reference:
	var StorageKey := ""
	var NextQueue: Reference
	signal Finished(_dataReceived)


class StorageCheckQueue extends StorageQueue:
	pass


class StorageWriteQueue extends StorageQueue:
	var Data := ""


func Dequeue() -> StorageQueue:
	if IsQueueEmpty():
		return null
	var _queue := _HeadQueue
	_HeadQueue = _HeadQueue.NextQueue
	_QueueSize -= 1
	if IsQueueEmpty():
		_TailQueue = null
	return _queue


func Enqueue(_newQueue: StorageQueue) -> void:
	if IsQueueEmpty():
		_HeadQueue = _newQueue
	else:
		_TailQueue.NextQueue = _newQueue
	_TailQueue = _newQueue
	_QueueSize += 1


func IsQueueEmpty() -> bool:
	return _QueueSize == 0


func ToPath(_key: String) -> String:
	return str("user://", _key.sha256_text(), ".dat")


func GetData(_key: String) -> StorageQueue:
	var _queue := StorageQueue.new()
	_queue.StorageKey = _key
	Enqueue(_queue)
	return _queue


func GetDataSync(_key: String) -> String:
	var _file := File.new()
	if _file.open(ToPath(_key), File.READ) != OK:
		return ""
	var _fileData := _file.get_as_text()
	_file.close()
	return _fileData


func HasData(_key: String) -> StorageCheckQueue:
	var _queue := StorageCheckQueue.new()
	_queue.StorageKey = _key
	Enqueue(_queue)
	return _queue


func HasDataSync(_key: String) -> bool:
	return File.new().file_exists(ToPath(_key))


func SetData(_key: String, _data: String = "") -> StorageWriteQueue:
	var _queue := StorageWriteQueue.new()
	_queue.StorageKey = _key
	_queue.Data = _data
	Enqueue(_queue)
	return _queue


func SetDataSync(_key: String, _data: String = "") -> void:
	var _path := ToPath(_key)
	if not _data:
		var _dir := Directory.new()
		if _dir.file_exists(_path):
			_dir.remove(_path)
		return
	var _file := File.new()
	if _file.open(_path, File.WRITE) != OK:
		return
	_file.store_string(_data)
	_file.close()


func _process(_delta: float) -> void:
	if IsQueueEmpty():
		return
	var _queue := Dequeue()
	if _queue is StorageCheckQueue:
		_queue.emit_signal("Finished", HasDataSync(_queue.StorageKey))
	elif _queue is StorageWriteQueue:
		_queue.emit_signal("Finished", SetDataSync(_queue.StorageKey, _queue.Data))
	else:
		_queue.emit_signal("Finished", GetDataSync(_queue.StorageKey))

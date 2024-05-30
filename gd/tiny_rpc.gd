extends Node
class_name Trpc


#GODOG_SERVER
signal PeerConnected(id)
signal PeerDisconnected(id)
#GODOG_SERVER
#GODOG_CLIENT
signal ClientConnected()
signal ClientDisconnected()
#GODOG_CLIENT

export var ServerPort := 12345
export var ServerAddress := ""
export var BufferMaxLength := 131072 # 128 KiB
export var ConnectToHostInDebug := false
export var EnableLocalRpcInProduction := false


#GODOG_SERVER
class TrpcServer extends Node:
	#GODOG_PRIVATE: _bufferMaxLength, _serverPort, _wsServer, _Trpc
	var _bufferMaxLength := 131072 # 128 KiB
	var _serverPort := 12345
	var _wsServer := WebSocketServer.new()

	onready var _Trpc: Trpc = get_parent()


	func _init(_port: int, _buffLength: int) -> void:
		_serverPort = _port
		_bufferMaxLength = _buffLength


	func _ready() -> void:
		_wsServer.connect("client_connected", self, "_clientConnected")
		_wsServer.connect("client_disconnected", self, "_clientDisconnected")
		_wsServer.connect("client_close_request", self, "_clientCloseRequest")
		_wsServer.connect("data_received", self, "_dataReceived")
		if _wsServer.listen(_serverPort) != OK:
			printerr("Unable to start a server at port %d." % _serverPort)
			return
		else:
			get_tree().connect("idle_frame", _wsServer, "poll")


	func _clientConnected(_peerId: int, _protocol: String = "") -> void:
		_wsServer.get_peer(_peerId).get_connected_host()
		_Trpc.emit_signal("PeerConnected", _peerId)
		print("OPEN ip: %s, id =  %d, proto = %s" % [_wsServer.get_peer(_peerId).get_connected_host(), _peerId, _protocol])


	func _clientCloseRequest(_peerId: int, _statusCode: int, _disconnectReason: String) -> void:
		print("CLOSE_REQ ip: %s, id =  %d, code = %d, reason = %s" % [_wsServer.get_peer(_peerId).get_connected_host(), _peerId, _statusCode, _disconnectReason])
	

	func _clientDisconnected(_peerId: int, _wasClean: bool = false) -> void:
		_Trpc.emit_signal("PeerDisconnected", _peerId)
		print("CLOSE ip: %s, id =  %d, clean = %s" % [_wsServer.get_peer(_peerId).get_connected_host(), _peerId, str(_wasClean)])


	func _dataReceived(_peerId: int) -> void:
		Trpc.ParsePeerPacket(_wsServer, _peerId)
#GODOG_SERVER


#GODOG_CLIENT
class TrpcClient extends Node:
	#GODOG_PRIVATE: _hostAddress, _wsClient
	var _hostAddress := ""
	var _wsClient := WebSocketClient.new()

	onready var _Trpc: Trpc = get_parent()


	func ConnectToHost() -> void:
		if _wsClient.connect_to_url(_hostAddress) != OK:
			#GODOG_IGNORE
			printerr("Failed to issue the connection to the address %s, retrying..." % _hostAddress)
			#GODOG_IGNORE
			Engine.remove_meta("_CLIENT_PEER")
			call_deferred("ConnectToHost")


	func _init(_addr: String) -> void:
		_hostAddress = _addr
	

	func _ready() -> void:
		_wsClient.connect("data_received", self, "_dataReceived")
		_wsClient.connect("connection_error", self, "_connectionClosed")
		_wsClient.connect("connection_closed", self, "_connectionClosed")
		_wsClient.connect("connection_established", self, "_connectionEstablished")
		call_deferred("ConnectToHost")


	func _connectionClosed(_wasClean: bool = false) -> void:
		get_tree().disconnect("idle_frame", _wsClient, "poll")
		_Trpc.emit_signal("ClientDisconnected")
		call_deferred("ConnectToHost")
		#GODOG_IGNORE
		printerr("Connection closed, reconnecting...")
		#GODOG_IGNORE
	

	func _connectionEstablished(_proto: String = "") -> void:
		Engine.set_meta("_CLIENT_PEER", _wsClient.get_peer(1))
		get_tree().connect("idle_frame", _wsClient, "poll")
		_Trpc.emit_signal("ClientConnected")
		#GODOG_IGNORE
		print("Connected to host %s." % _hostAddress)
		#GODOG_IGNORE


	func _dataReceived() -> void:
		Trpc.ParsePeerPacket(_wsClient)
#GODOG_CLIENT


static func IsValidFuncCall(_funcArgs: Array) -> bool:
	if _funcArgs.size() == 0:
		return false
	if typeof(_funcArgs[0]) != TYPE_STRING:
		return false
	return true


static func ParsePeerPacket(_wsMpPeer: WebSocketMultiplayerPeer, _peerId: int = 1) -> void:
	var _peer := _wsMpPeer.get_peer(_peerId)
	var _pkt := _peer.get_packet()
	if _pkt.empty():
		#GODOG_SERVER
		printerr("%s Sent an empty packet." % _peer.get_connected_host())
		#GODOG_SERVER
		return
	var _obj = str2var(_pkt.get_string_from_utf8())
	if typeof(_obj) != TYPE_ARRAY:
		#GODOG_SERVER
		printerr("%s Sent an invalid data type packet, not an array." % _peer.get_connected_host())
		#GODOG_SERVER
		return
	Trpc.DispatchFuncCall(_peer, _obj)


static func DispatchFuncCall(_peer: WebSocketPeer, _funcArgs: Array) -> void:
	if not IsValidFuncCall(_funcArgs):
		#GODOG_SERVER
		printerr("Invalid RPC: %s" % var2str(_funcArgs))
		#GODOG_SERVER
		return
	var _funcName: String = _funcArgs.pop_front()
	var _funcMap := Trpc.GetFuncMap()
	if not (_funcName in _funcMap):
		#GODOG_SERVER
		printerr("Function '%s' not found, RPC failed.")
		#GODOG_SERVER
		return
	(_funcMap[_funcName] as FuncRef).call_funcv([ _peer ] + _funcArgs)


static func GetClientPeer() -> WebSocketPeer:
	return Engine.get_meta("_CLIENT_PEER")


static func GetFuncMap() -> Dictionary:
	var _a := "_GODOG_RPC_FUNC_MAP"
	if not Engine.has_meta(_a):
		Engine.set_meta(_a, {})
	return Engine.get_meta(_a)


static func HasClientPeer() -> bool:
	return Engine.has_meta("_CLIENT_PEER")


static func _Rpc(_funcArgs: Array, _peer: WebSocketPeer) -> void:
	if not IsValidFuncCall(_funcArgs):
		#GODOG_SERVER
		printerr("Invalid RPC: %s" % var2str(_funcArgs))
		#GODOG_SERVER
		return
	_peer.put_packet(var2str(_funcArgs).to_utf8())


#GODOG_CLIENT
static func Request(_funcArgs) -> void:
	if HasClientPeer():
		_Rpc(_funcArgs, GetClientPeer())
	else:
		DispatchFuncCall(null, _funcArgs)
#GODOG_CLIENT


#GODOG_SERVER
static func Response(_peer: WebSocketPeer, _funcArgs: Array) -> void:
	if _peer:
		_Rpc(_funcArgs, _peer)
	else:
		DispatchFuncCall(null, _funcArgs)
#GODOG_SERVER


static func RegisterFunc(_funcName: String, _obj: Object, _objFuncName: String = "") -> void:
	if not _objFuncName:
		_objFuncName = _funcName
	var _funcMap := GetFuncMap()
	if _objFuncName in _funcMap:
		#GODOG_SERVER
		printerr("'%s' already got registered, replacing...")
		#GODOG_SERVER
		pass
	_funcMap[_funcName] = funcref(_obj, _objFuncName)


func _ready() -> void:
	if EnableLocalRpcInProduction:
		return
	#GODOG_IGNORE
	if OS.get_name() == "Server":
	#GODOG_IGNORE
	#GODOG_SERVER
		add_child(TrpcServer.new(ServerPort, BufferMaxLength))
	#GODOG_SERVER
	#GODOG_IGNORE
		return
	if not OS.is_debug_build() or ConnectToHostInDebug:
	#GODOG_IGNORE
	#GODOG_CLIENT
		add_child(TrpcClient.new(ServerAddress))
	#GODOG_CLIENT
	#GODOG_IGNORE
		return
	#GODOG_IGNORE

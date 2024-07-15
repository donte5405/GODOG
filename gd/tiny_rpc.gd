extends Node


#GODOG_SERVER
signal PeerConnected(id)
signal PeerDisconnected(id)
#GODOG_SERVER
#GODOG_CLIENT
signal ClientConnected()
signal ClientDisconnected()
#GODOG_CLIENT


#GODOG_PRIVATE: _FuncMap, _ClientPeer
var _FuncMap := {}
var _ClientPeer: WebSocketPeer

export var ServerPort := 12345
export var ServerAddress := ""
export var BufferMaxLength := 131072 # 128 KiB
export var ConnectToHostInDebug := false
export(String, FILE, "*.crt") var SslPublicKeyPath := ""
export(String, FILE, "*.key") var SslPrivateKeyPath := ""


#GODOG_SERVER
class TrpcServer extends Node:
	#GODOG_PRIVATE: _bufferMaxLength, _serverPort, _wsServer, _Trpc
	var _wsServer := WebSocketServer.new()

	onready var _Trpc := get_parent()


	func _ready() -> void:
		if _Trpc.SslPublicKeyPath and _Trpc.SslPrivateKeyPath:
			var _publicKey := X509Certificate.new()
			var _privateKey := CryptoKey.new()
			_publicKey.load(_Trpc.SslPublicKeyPath)
			_privateKey.load(_Trpc.SslPrivateKeyPath)
			_wsServer.ssl_certificate = _publicKey
			_wsServer.private_key = _privateKey
		_wsServer.connect("client_connected", self, "_clientConnected")
		_wsServer.connect("client_disconnected", self, "_clientDisconnected")
		_wsServer.connect("client_close_request", self, "_clientCloseRequest")
		_wsServer.connect("data_received", self, "_dataReceived")
		if _wsServer.listen(_Trpc.ServerPort) != OK:
			printerr("Unable to start a server at port %d." % _Trpc.ServerPort)
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
		_Trpc._ParsePeerPacket(_wsServer, _peerId)
#GODOG_SERVER


#GODOG_CLIENT
class TrpcClient extends Node:
	#GODOG_PRIVATE: _hostAddress, _wsClient
	var _wsClient := WebSocketClient.new()

	onready var _Trpc := get_parent()


	func ConnectToHost() -> void:
		if _wsClient.connect_to_url(_Trpc.ServerAddress) != OK:
			#GODOG_IGNORE
			printerr("Failed to issue the connection to the address %s, retrying..." % _Trpc.ServerAddress)
			#GODOG_IGNORE
			_Trpc._ClientPeer = null
			call_deferred("ConnectToHost")


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
		_Trpc._ClientPeer = _wsClient.get_peer(1)
		get_tree().connect("idle_frame", _wsClient, "poll")
		_Trpc.emit_signal("ClientConnected")
		#GODOG_IGNORE
		print("Connected to host %s." % _Trpc.ServerAddress)
		#GODOG_IGNORE


	func _dataReceived() -> void:
		_Trpc._ParsePeerPacket(_wsClient)
#GODOG_CLIENT


func _ParsePeerPacket(_wsMpPeer: WebSocketMultiplayerPeer, _peerId: int = 1) -> void:
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
	_DispatchFuncCall(_peer, _obj)


func _IsValidFuncCall(_funcArgs: Array) -> bool:
	if _funcArgs.size() == 0:
		return false
	if typeof(_funcArgs[0]) != TYPE_STRING:
		return false
	return true


func _DispatchFuncCall(_peer: WebSocketPeer, _funcArgs: Array) -> void:
	if not _IsValidFuncCall(_funcArgs):
		#GODOG_SERVER
		printerr("Invalid RPC: %s" % var2str(_funcArgs))
		#GODOG_SERVER
		return
	var _funcName: String = _funcArgs.pop_front()
	if not (_funcName in _FuncMap):
		#GODOG_SERVER
		printerr("Function '%s' not found, RPC failed.")
		#GODOG_SERVER
		return
	(_FuncMap[_funcName] as FuncRef).call_funcv([ _peer ] + _funcArgs)


func _Rpc(_funcArgs: Array, _peer: WebSocketPeer) -> void:
	if not _IsValidFuncCall(_funcArgs):
		#GODOG_SERVER
		printerr("Invalid RPC: %s" % var2str(_funcArgs))
		#GODOG_SERVER
		return
	_peer.put_packet(var2str(_funcArgs).to_utf8())


#GODOG_CLIENT
func Request(_funcArgs) -> void:
	if _ClientPeer:
		_Rpc(_funcArgs, _ClientPeer)
	else:
		_DispatchFuncCall(null, _funcArgs)
#GODOG_CLIENT


#GODOG_SERVER
func Response(_peer: WebSocketPeer, _funcArgs: Array) -> void:
	if _peer:
		_Rpc(_funcArgs, _peer)
	else:
		_DispatchFuncCall(null, _funcArgs)
#GODOG_SERVER


func RegisterFunc(_funcName: String, _obj: Object, _objFuncName: String = "") -> void:
	if not _objFuncName:
		_objFuncName = _funcName
	if _objFuncName in _FuncMap:
		#GODOG_SERVER
		printerr("'%s' already got registered, replacing...")
		#GODOG_SERVER
		pass
	_FuncMap[_funcName] = funcref(_obj, _objFuncName)


func _ready() -> void:
	#GODOG_IGNORE
	if OS.get_name() == "Server":
	#GODOG_IGNORE
	#GODOG_SERVER
		add_child(TrpcServer.new())
	#GODOG_SERVER
	#GODOG_IGNORE
		return
	if not OS.is_debug_build() or ConnectToHostInDebug:
	#GODOG_IGNORE
	#GODOG_CLIENT
		add_child(TrpcClient.new())
	#GODOG_CLIENT
	#GODOG_IGNORE
		return
	#GODOG_IGNORE

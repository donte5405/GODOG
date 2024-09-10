extends Node


#GODOG_SERVER
signal PeerConnected(id)
signal PeerDisconnected(id)
#GODOG_SERVER
#GODOG_CLIENT
signal ClientConnected()
signal ClientDisconnected()
signal ServerCloseRequest(_closeCode, _closeReason)
#GODOG_CLIENT


#GODOG_PRIVATE: _FuncMap, _ClientPeer
var _FuncMap := {}
#GODOG_CLIENT
var _ClientPeer: WebSocketPeer
#GODOG_CLIENT
#GODOG_SERVER
var _dummyPeerStorage := {}
#GODOG_SERVER

export var UseJson := true
export var ServerPort := 12345
export var ServerAddress := ""
export var ServerDebugAddress := "" # This is not used by TinyRPC, but it's there for ease of debugging.
#GODOG_CLIENT
export var ConnectToHostInDebug := false
#GODOG_CLIENT
#GODOG_SERVER
export var MaxConnections := 4096
export var BufferMaxLength := 131072 # 128 KiB
export(String, FILE, "*.crt") var SslPublicKeyPath := ""
export(String, FILE, "*.key") var SslPrivateKeyPath := ""
#GODOG_SERVER


#GODOG_SERVER
class TrpcServer extends Node:
	#GODOG_PRIVATE: _currentConnections, _wsServer, _Trpc
	var _currentConnections := 0
	var _wsServer := WebSocketServer.new()

	onready var _Trpc := get_parent()


	func CountConnections(_newConnections: int) -> void:
		_currentConnections += _newConnections
		_wsServer.refuse_new_connections = _currentConnections >= _Trpc.MaxConnections


	func _PeerConnected(_peerId: int, _protocol: String = "") -> void:
		CountConnections(1)
		_Trpc.emit_signal("PeerConnected", _peerId)
		#GODOG_IGNORE
		print("OPEN ip: %s, id =  %d, proto = %s" % [_wsServer.get_peer(_peerId).get_connected_host(), _peerId, _protocol])
		#GODOG_IGNORE


	func _PeerCloseRequest(_peerId: int, _statusCode: int, _disconnectReason: String) -> void:
		#GODOG_IGNORE
		print("CLOSE REQ ip: %s, id =  %d, code = %d, reason = %s" % [_wsServer.get_peer(_peerId).get_connected_host(), _peerId, _statusCode, _disconnectReason])
		#GODOG_IGNORE
		pass
	

	func _PeerDisconnected(_peerId: int, _wasClean: bool = false) -> void:
		CountConnections(-1)
		_Trpc.emit_signal("PeerDisconnected", _peerId)
		#GODOG_IGNORE
		print("CLOSE IP: %s, id =  %d, clean = %s" % [_wsServer.get_peer(_peerId).get_connected_host(), _peerId, str(_wasClean)])
		#GODOG_IGNORE


	func _DataReceived(_peerId: int) -> void:
		_Trpc._ParsePeerPacket(_wsServer.get_peer(_peerId), true)


	func _DataReceivedJson(_peerId: int) -> void:
		_Trpc._ParsePeerPacketJson(_wsServer.get_peer(_peerId), true)


	func _ready() -> void:
		if _Trpc.SslPublicKeyPath and _Trpc.SslPrivateKeyPath:
			var _publicKey := X509Certificate.new()
			var _privateKey := CryptoKey.new()
			_publicKey.load(_Trpc.SslPublicKeyPath)
			_privateKey.load(_Trpc.SslPrivateKeyPath)
			_wsServer.ssl_certificate = _publicKey
			_wsServer.private_key = _privateKey
		_wsServer.connect("client_connected", self, "_PeerConnected")
		_wsServer.connect("client_disconnected", self, "_PeerDisconnected")
		_wsServer.connect("client_close_request", self, "_PeerCloseRequest")
		_wsServer.connect("data_received", self, "_DataReceivedJson" if _Trpc.UseJson else "_DataReceived")
		if _wsServer.listen(_Trpc.ServerPort) != OK:
			#GODOG_IGNORE
			printerr("Unable to start a server at port %d." % _Trpc.ServerPort)
			#GODOG_IGNORE
			return


	func _process(_delta: float) -> void:
		_wsServer.poll()
#GODOG_SERVER


#GODOG_CLIENT
class TrpcClient extends Node:
	#GODOG_PRIVATE: _serverClosed, _wsClient
	var _serverClosed := false
	var _wsClient := WebSocketClient.new()

	onready var _Trpc := get_parent()


	func GetFullAddress() -> String:
		return str(_Trpc.ServerAddress, ":", _Trpc.ServerPort)


	func ConnectToHost() -> void:
		if _wsClient.connect_to_url(GetFullAddress()) != OK:
			#GODOG_IGNORE
			printerr("Failed to issue the connection to the address %s, retrying..." % GetFullAddress())
			#GODOG_IGNORE
			_Trpc._ClientPeer = null
			call_deferred("ConnectToHost")


	func _ConnectionClosed(_wasClean: bool = false) -> void:
		_Trpc.emit_signal("ClientDisconnected")
		if not _serverClosed:
			call_deferred("ConnectToHost")
			#GODOG_IGNORE
			printerr("Connection closed, reconnecting...")
			#GODOG_IGNORE


	func _ConnectionEstablished(_proto: String = "") -> void:
		_Trpc._ClientPeer = _wsClient.get_peer(1)
		_Trpc.emit_signal("ClientConnected")
		#GODOG_IGNORE
		print("Connected to host %s." % GetFullAddress())
		#GODOG_IGNORE


	func _DataReceived() -> void:
		_Trpc._ParsePeerPacket(_wsClient.get_peer(1), false)
	

	func _DataReceivedJson() -> void:
		_Trpc._ParsePeerPacketJson(_wsClient.get_peer(1), false)


	func _ServerCloseRequest(_code: int, _reason: String) -> void:
		_serverClosed = true
		_Trpc.emit_signal("ServerCloseRequest", _code, _reason)


	func _ready() -> void:
		_wsClient.connect("connection_error", self, "_ConnectionClosed")
		_wsClient.connect("connection_closed", self, "_ConnectionClosed")
		_wsClient.connect("connection_established", self, "_ConnectionEstablished")
		_wsClient.connect("server_close_request", self, "_ServerCloseRequest")
		_wsClient.connect("data_received", self, "_DataReceivedJson" if _Trpc.UseJson else "_DataReceived")
		call_deferred("ConnectToHost")


	func _process(_delta: float) -> void:
		_wsClient.poll()
#GODOG_CLIENT


func _ParsePeerPacket(_peer: WebSocketPeer, _isServer: bool) -> void:
	var _str := _peer.get_packet().get_string_from_utf8()
	if _str.empty():
		#GODOG_IGNORE
		printerr("%s Sent an empty packet." % _peer.get_connected_host())
		#GODOG_IGNORE
		return
	for _sName in [ "CSharpScript", "GDScript", "VisualScript" ]: # This is just a bandage solution, I don't trust this.
		if _sName in _str:
			return
	var _obj = str2var(_str)
	if typeof(_obj) != TYPE_ARRAY:
		#GODOG_IGNORE
		printerr("%s Sent an invalid data type packet, not an array." % _peer.get_connected_host())
		#GODOG_IGNORE
		return
	_DispatchFuncCall(_peer, _isServer, _obj)


func _ParsePeerPacketJson(_peer: WebSocketPeer, _isServer: bool) -> void:
	var _str := _peer.get_packet().get_string_from_utf8()
	if _str.empty():
		#GODOG_IGNORE
		printerr("%s Sent an empty packet." % _peer.get_connected_host())
		#GODOG_IGNORE
		return
	var _obj = JSON.parse(_str).result
	if typeof(_obj) != TYPE_ARRAY:
		#GODOG_IGNORE
		printerr("%s Sent an invalid JSON data type packet, not an array." % _peer.get_connected_host())
		#GODOG_IGNORE
		return
	_DispatchFuncCall(_peer, _isServer, _obj)


func _IsValidFuncCall(_funcArgs: Array) -> bool:
	if _funcArgs.size() == 0:
		return false
	if typeof(_funcArgs[0]) != TYPE_STRING:
		return false
	return true


func _DispatchFuncCall(_peer: WebSocketPeer, _isServer: bool, _funcArgs: Array) -> void:
	if not _IsValidFuncCall(_funcArgs):
		#GODOG_IGNORE
		printerr("Invalid RPC: %s" % var2str(_funcArgs))
		#GODOG_IGNORE
		return
	var _funcName: String = _funcArgs.pop_front()
	if not (_funcName in _FuncMap):
		#GODOG_IGNORE
		printerr("Function '%s' not found, RPC failed." % _funcName)
		#GODOG_IGNORE
		return
	var _func: FuncRef = _FuncMap[_funcName]
	if not _func.is_valid():
		return
	if _isServer:
		_func.call_funcv([ _peer ] + _funcArgs)
	else:
		_func.call_funcv(_funcArgs)


func _Rpc(_peer: WebSocketPeer, _funcArgs: Array) -> void:
	if not _IsValidFuncCall(_funcArgs):
		#GODOG_IGNORE
		printerr("Invalid RPC: %s" % var2str(_funcArgs))
		#GODOG_IGNORE
		return
	if UseJson:
		_peer.put_packet(JSON.print(_funcArgs).to_utf8())
	else:
		_peer.put_packet(var2str(_funcArgs).to_utf8())


#GODOG_CLIENT
func Request(_funcArgs: Array) -> void:
	if _ClientPeer:
		_Rpc(_ClientPeer, _funcArgs)
	else:
		_DispatchFuncCall(null, true, _funcArgs)
#GODOG_CLIENT


#GODOG_SERVER
func GetPeerAddress(_peer: WebSocketPeer) -> String:
	#GODOG_IGNORE
	return "localhost"
	#GODOG_IGNORE
	return _peer.get_connected_host()


func GetPeerStorage(_peer: WebSocketPeer) -> Dictionary:
	#GODOG_IGNORE
	return _dummyPeerStorage
	#GODOG_IGNORE
	if not _peer.has_meta("PEER_STORAGE"):
		_peer.set_meta("PEER_STORAGE", {})
	return _peer.get_meta("PEER_STORAGE")


func PassCall(_peer: WebSocketPeer, _funcArgs: Array) -> void:
	_DispatchFuncCall(_peer, true, _funcArgs)


func Response(_peer: WebSocketPeer, _funcArgs: Array) -> void:
	if _peer:
		_Rpc(_peer, _funcArgs)
	else:
		_DispatchFuncCall(null, false, _funcArgs)
#GODOG_SERVER


func GetServerUrl() -> String:
	#GODOG_IGNORE
	if OS.get_name() == "Server":
	#GODOG_IGNORE
	#GODOG_SERVER
		return ServerAddress
	#GODOG_SERVER
	#GODOG_IGNORE
	if not OS.is_debug_build() or ConnectToHostInDebug:
	#GODOG_IGNORE
	#GODOG_CLIENT
		return ServerAddress
	#GODOG_CLIENT
	#GODOG_IGNORE
	else:
		return ServerDebugAddress
	#GODOG_IGNORE


func RegisterFunc(_funcName: String, _obj: Object, _objFuncName: String = "") -> void:
	if not _objFuncName:
		_objFuncName = _funcName
	if _objFuncName in _FuncMap:
		#GODOG_IGNORE
		printerr("'%s' already got registered, replacing..." % _funcName)
		#GODOG_IGNORE
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

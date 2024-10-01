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
var _DummyPeerStorage := {}
#GODOG_SERVER

export var UseJson := true
export var ServerPort := 12345
export var ServerAddress := ""
export var ServerDebugAddress := "" # For ease of debugging.
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
	#GODOG_PRIVATE: _CurrentConnections, _WsServer, _Trpc
	var _CurrentConnections := 0
	var _WsServer := WebSocketServer.new()

	onready var _Trpc := get_parent()


	func CountConnections(_newConnections: int) -> void:
		_CurrentConnections += _newConnections
		_WsServer.refuse_new_connections = _CurrentConnections >= _Trpc.MaxConnections


	func _PeerConnected(_peerId: int, _protocol: String = "") -> void:
		CountConnections(1)
		var _peer := _WsServer.get_peer(_peerId)
		_Trpc.emit_signal("PeerConnected", _peer)
		#GODOG_IGNORE
		print("OPEN ip: %s, id =  %d, proto = %s" % [_peer.get_connected_host(), _peerId, _protocol])
		#GODOG_IGNORE


	func _PeerCloseRequest(_peerId: int, _statusCode: int, _disconnectReason: String) -> void:
		#GODOG_IGNORE
		var _peer := _WsServer.get_peer(_peerId)
		print("CLOSE REQ ip: %s, id =  %d, code = %d, reason = %s" % [_peer.get_connected_host(), _peerId, _statusCode, _disconnectReason])
		#GODOG_IGNORE
		pass
	

	func _PeerDisconnected(_peerId: int, _wasClean: bool = false) -> void:
		CountConnections(-1)
		var _peer := _WsServer.get_peer(_peerId)
		_Trpc.emit_signal("PeerDisconnected", _peer)
		#GODOG_IGNORE
		print("CLOSE IP: %s, id =  %d, clean = %s" % [_peer.get_connected_host(), _peerId, str(_wasClean)])
		#GODOG_IGNORE


	func _DataReceived(_peerId: int) -> void:
		_Trpc._ParsePeerPacket(_WsServer.get_peer(_peerId), true)


	func _DataReceivedJson(_peerId: int) -> void:
		_Trpc._ParsePeerPacketJson(_WsServer.get_peer(_peerId), true)


	func _ready() -> void:
		if _Trpc.SslPublicKeyPath and _Trpc.SslPrivateKeyPath:
			var _publicKey := X509Certificate.new()
			var _privateKey := CryptoKey.new()
			_publicKey.load(_Trpc.SslPublicKeyPath)
			_privateKey.load(_Trpc.SslPrivateKeyPath)
			_WsServer.ssl_certificate = _publicKey
			_WsServer.private_key = _privateKey
		_WsServer.connect("client_connected", self, "_PeerConnected")
		_WsServer.connect("client_disconnected", self, "_PeerDisconnected")
		_WsServer.connect("client_close_request", self, "_PeerCloseRequest")
		_WsServer.connect("data_received", self, "_DataReceivedJson" if _Trpc.UseJson else "_DataReceived")
		if _WsServer.listen(_Trpc.ServerPort) != OK:
			#GODOG_IGNORE
			printerr("Unable to start a server at port %d." % _Trpc.ServerPort)
			#GODOG_IGNORE
			return


	func _process(_delta: float) -> void:
		_WsServer.poll()
#GODOG_SERVER


#GODOG_CLIENT
class TrpcClient extends Node:
	#GODOG_PRIVATE: _ServerClosed, _WsClient
	var _ServerClosed := false
	var _WsClient := WebSocketClient.new()

	onready var _Trpc := get_parent()


	func GetFullAddress() -> String:
		return str(_Trpc.GetServerUrl(), ":", _Trpc.ServerPort)


	func ConnectToHost() -> void:
		if _WsClient.connect_to_url(GetFullAddress()) != OK:
			#GODOG_IGNORE
			printerr("Failed to issue the connection to the address %s, retrying..." % GetFullAddress())
			#GODOG_IGNORE
			_Trpc._ClientPeer = null
			call_deferred("ConnectToHost")


	func _ConnectionClosed(_wasClean: bool = false) -> void:
		_Trpc.emit_signal("ClientDisconnected")
		if not _ServerClosed:
			call_deferred("ConnectToHost")
			#GODOG_IGNORE
			printerr("Connection closed, reconnecting...")
			#GODOG_IGNORE


	func _ConnectionEstablished(_proto: String = "") -> void:
		_Trpc._ClientPeer = _WsClient.get_peer(1)
		_Trpc.emit_signal("ClientConnected")
		#GODOG_IGNORE
		print("Connected to host %s." % GetFullAddress())
		#GODOG_IGNORE


	func _DataReceived() -> void:
		_Trpc._ParsePeerPacket(_WsClient.get_peer(1), false)
	

	func _DataReceivedJson() -> void:
		_Trpc._ParsePeerPacketJson(_WsClient.get_peer(1), false)


	func _ServerCloseRequest(_code: int, _reason: String) -> void:
		_ServerClosed = true
		_Trpc.emit_signal("ServerCloseRequest", _code, _reason)


	func _ready() -> void:
		_WsClient.connect("connection_error", self, "_ConnectionClosed")
		_WsClient.connect("connection_closed", self, "_ConnectionClosed")
		_WsClient.connect("connection_established", self, "_ConnectionEstablished")
		_WsClient.connect("server_close_request", self, "_ServerCloseRequest")
		_WsClient.connect("data_received", self, "_DataReceivedJson" if _Trpc.UseJson else "_DataReceived")
		call_deferred("ConnectToHost")


	func _process(_delta: float) -> void:
		_WsClient.poll()
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
	return _DummyPeerStorage
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
	if OS.is_debug_build():
		return ServerDebugAddress
	else:
	#GODOG_IGNORE
		return ServerAddress


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

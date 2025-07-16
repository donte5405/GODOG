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


#GODOG_PRIVATE: _FuncMap
var _FuncMap := {}
var _WsMpPeer: WebSocketMultiplayerPeer
#GODOG_SERVER
var _PeerStorage := {}
#GODOG_SERVER
#GODOG_IGNORE
var _DummyPeerStorage := NewPeerStorage()
#GODOG_IGNORE

export var UseJson := true
export var ServerPort := 12345
export var ServerAddress := ""
export var ServerDebugAddress := "http://127.0.0.1" # For ease of debugging.
export var AllowObjectDeserialiseOnServer := false
#GODOG_CLIENT
export var ConnectToHostInDebug := false
#GODOG_CLIENT
#GODOG_SERVER
export var MaxConnections := 4096
export var BufferMaxLength := 131072 # 128 KiB
export var ClientDelaySeconds := 0.05
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
		_Trpc._PeerStorage[_peerId] = _Trpc.NewPeerStorage()
		_Trpc.emit_signal("PeerConnected", _peerId)
		#GODOG_IGNORE
		print("OPEN IP: %s, id =  %d, proto = %s" % [_WsServer.get_peer(_peerId).get_connected_host(), _peerId, _protocol])
		#GODOG_IGNORE


	func _PeerCloseRequest(_peerId: int, _statusCode: int, _disconnectReason: String) -> void:
		#GODOG_IGNORE
		print("CLOSE REQ IP: %s, id =  %d, code = %d, reason = %s" % [_WsServer.get_peer(_peerId).get_connected_host(), _peerId, _statusCode, _disconnectReason])
		#GODOG_IGNORE
		pass
	

	func _PeerDisconnected(_peerId: int, _wasClean: bool = false) -> void:
		CountConnections(-1)
		_Trpc.emit_signal("PeerDisconnected", _peerId)
		_Trpc._PeerStorage.erase(_peerId)
		#GODOG_IGNORE
		print("CLOSE IP: %s, id =  %d, clean = %s" % [_WsServer.get_peer(_peerId).get_connected_host(), _peerId, str(_wasClean)])
		#GODOG_IGNORE


	func _DataReceived(_peerId: int) -> void:
		if _Trpc.IsClientTooFast(_peerId):
			return
		_Trpc._ParsePeerPacket(_peerId, true)


	func _DataReceivedJson(_peerId: int) -> void:
		_Trpc._ParsePeerPacketJson(_peerId, true)


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
		_Trpc._WsMpPeer = _WsServer


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


	func ConnectToHostLater():
		yield(get_tree(), "idle_frame")
		ConnectToHost()


	func ConnectToHost() -> void:
		if _WsClient.connect_to_url(GetFullAddress()) != OK:
			#GODOG_IGNORE
			printerr("Failed to issue the connection to the address %s, retrying..." % GetFullAddress())
			#GODOG_IGNORE
			_Trpc._WsMpPeer = null
			ConnectToHostLater()


	func _ConnectionClosed(_wasClean: bool = false) -> void:
		_Trpc.emit_signal("ClientDisconnected")
		if not _ServerClosed:
			ConnectToHostLater()
			#GODOG_IGNORE
			printerr("Connection closed, reconnecting...")
			#GODOG_IGNORE


	func _ConnectionEstablished(_proto: String = "") -> void:
		_Trpc._WsMpPeer = _WsClient
		_Trpc.emit_signal("ClientConnected")
		#GODOG_IGNORE
		print("Connected to host %s." % GetFullAddress())
		#GODOG_IGNORE


	func _DataReceived() -> void:
		_Trpc._ParsePeerPacket(1, false)
	

	func _DataReceivedJson() -> void:
		_Trpc._ParsePeerPacketJson(1, false)


	func _ServerCloseRequest(_code: int, _reason: String) -> void:
		_ServerClosed = true
		_Trpc.emit_signal("ServerCloseRequest", _code, _reason)


	func _ready() -> void:
		_WsClient.connect("connection_error", self, "_ConnectionClosed")
		_WsClient.connect("connection_closed", self, "_ConnectionClosed")
		_WsClient.connect("connection_established", self, "_ConnectionEstablished")
		_WsClient.connect("server_close_request", self, "_ServerCloseRequest")
		_WsClient.connect("data_received", self, "_DataReceivedJson" if _Trpc.UseJson else "_DataReceived")
		ConnectToHostLater()


	func _process(_delta: float) -> void:
		_WsClient.poll()
#GODOG_CLIENT


func _ParsePeerPacket(_peerId: int, _isServer: bool) -> void:
	var _str := _WsMpPeer.get_peer(_peerId).get_packet().get_string_from_utf8()
	if _str.empty():
		#GODOG_IGNORE
		printerr("%s Sent an empty packet." % GetPeerAddress(_peerId))
		#GODOG_IGNORE
		return
	for _sName in [ "CSharpScript", "GDScript", "VisualScript" ]: # This is just a bandage solution, I don't trust this.
		if _sName in _str:
			return
	var _obj = str2var(_str)
	if typeof(_obj) != TYPE_ARRAY:
		#GODOG_IGNORE
		printerr("%s Sent an invalid data type packet, not an array." % GetPeerAddress(_peerId))
		#GODOG_IGNORE
		return
	_DispatchFuncCalls(_peerId, _isServer, _obj)


func _ParsePeerPacketJson(_peerId: int, _isServer: bool) -> void:
	var _str := _WsMpPeer.get_peer(_peerId).get_packet().get_string_from_utf8()
	if _str.empty():
		#GODOG_IGNORE
		printerr("%s Sent an empty packet." % GetPeerAddress(_peerId))
		#GODOG_IGNORE
		return
	var _obj = Dict.Deserialise(_str, AllowObjectDeserialiseOnServer if _isServer else true)
	if typeof(_obj) != TYPE_ARRAY:
		#GODOG_IGNORE
		printerr("%s Sent an invalid JSON data type packet, not an array." % GetPeerAddress(_peerId))
		#GODOG_IGNORE
		return
	_DispatchFuncCalls(_peerId, _isServer, _obj)


func _DispatchFuncCalls(_peerId: int, _isServer: bool, _calls: Array) -> void:
	if _calls.size():
		if not _isServer:
			if _calls[0] is Array:
				for _ref in _calls:
					if _ref[0] == "_Delay":
						var _timeLeft: float = _ref[1]
						while _timeLeft > 0:
							yield(get_tree(), "idle_frame")
							_timeLeft -= get_process_delta_time()
					else:
						_DispatchFuncCall(_peerId, _isServer, _ref)
				return
		_DispatchFuncCall(_peerId, _isServer, _calls)


func _DispatchFuncCall(_peerId: int, _isServer: bool, _funcArgs: Array) -> void:
	if typeof(_funcArgs[0]) != TYPE_STRING:
		return
	#GODOG_IGNORE
	print(str("TRPC: ", Dict.Serialise(_funcArgs)))
	#GODOG_IGNORE
	var _funcName: String = _funcArgs.pop_front()
	if not (_funcName in _FuncMap):
		#GODOG_IGNORE
		printerr("Function '%s' not found, RPC failed." % _funcName)
		#GODOG_IGNORE
		return
	if _isServer:
		_funcArgs = [ _peerId ] + _funcArgs
	var _funcs: Array = _FuncMap[_funcName]
	var _i := 0
	while _i < _funcs.size():
		var _func: FuncRef = _funcs[_i]
		if not _func.is_valid():
			_funcs.remove(_i)
			continue
		_func.call_funcv(_funcArgs)
		_i += 1


#GODOG_IGNORE
func _SimulateNetworkCall(_funcArgs: Array, _toServer: bool) -> void:
	# Convert data back and forth to simulate server-client communication, easier to detect bugs.
	if UseJson:
		if _toServer:
			if IsClientTooFast(1):
				return
			_DispatchFuncCalls(1, true, Dict.Deserialise(Dict.Serialise(_funcArgs, false, AllowObjectDeserialiseOnServer), AllowObjectDeserialiseOnServer))
		else:
			_DispatchFuncCalls(1, false, Dict.Deserialise(Dict.Serialise(_funcArgs, false, true), true))
	else:
		if _toServer:
			if IsClientTooFast(1):
				return
		_DispatchFuncCalls(1, _toServer, str2var(var2str(_funcArgs)))
#GODOG_IGNORE


func _Rpc(_peerId: int, _funcArgs: Array, _toServer: bool) -> void:
	if UseJson:
		_WsMpPeer.get_peer(_peerId).put_packet(Dict.Serialise(_funcArgs, false, AllowObjectDeserialiseOnServer if _toServer else true).to_utf8())
	else:
		_WsMpPeer.get_peer(_peerId).put_packet(var2str(_funcArgs).to_utf8())


func ServerCallFunc(_peerId: int, _funcArgs: Array) -> void:
	_DispatchFuncCalls(_peerId, true, _funcArgs)


func CallFunc(_funcArgs: Array) -> void:
	_DispatchFuncCalls(1, true, _funcArgs)


#GODOG_CLIENT
func Request(_funcArgs: Array) -> void:
	if _WsMpPeer:
		_Rpc(1, _funcArgs, true)
	#GODOG_IGNORE
	else:
		call_deferred("_SimulateNetworkCall", _funcArgs, true)
	#GODOG_IGNORE
#GODOG_CLIENT


#GODOG_SERVER
func NewPeerStorage() -> Dictionary:
	return { RecentPacketTimestamp = Time.get_unix_time_from_system() }


func IsClientTooFast(_peerId: int) -> bool:
	if ClientDelaySeconds == 0:
		return false
	var _storage = GetPeerStorage(_peerId)
	var _currentTime = Time.get_unix_time_from_system()
	if _currentTime - _storage.RecentPacketTimestamp < ClientDelaySeconds:
		return true
	_storage.RecentPacketTimestamp = _currentTime
	return false


func GetPeerAddress(_peerId: int) -> String:
	#GODOG_IGNORE
	return "localhost"
	#GODOG_IGNORE
	return _WsMpPeer.get_peer(_peerId).get_connected_host()


func GetPeerStorage(_peerId: int) -> Dictionary:
	#GODOG_IGNORE
	return _DummyPeerStorage
	#GODOG_IGNORE
	if not _PeerStorage.has(_peerId):
		_PeerStorage[_peerId] = {}
	return _PeerStorage[_peerId]


func Response(_peerId: int, _funcArgs: Array) -> void:
	if _WsMpPeer:
		_Rpc(_peerId, _funcArgs, false)
	#GODOG_IGNORE
	else:
		call_deferred("_SimulateNetworkCall", _funcArgs, false)
	#GODOG_IGNORE
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
	if not (_funcName in _FuncMap):
		_FuncMap[_funcName] = []
	_FuncMap[_funcName].push_back(funcref(_obj, _objFuncName))


func _ready() -> void:
	#GODOG_IGNORE
	if OS.has_feature("Server"):
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

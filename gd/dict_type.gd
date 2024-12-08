class_name Dict


const K_ARRAY = "$array"
const K_TYPE = "$type"


static func SetObject(_d: Dictionary, _o: Object) -> Object:
	_d = ToDictionary(_d)
	for _k in _d.keys():
		_o.set(_k, _d[_k])
	return _o


static func ToVariant(_v):
	if _v is Array:
		return ToArray(_v)
	elif _v is Dictionary:
		if _v.has(K_TYPE):
			var _t: String = _v[K_TYPE]
			_v.erase(K_TYPE)
			if _t == "AABB":
				return ToAABB(_v)
			elif _t == "Basis":
				return ToBasis(_v)
			elif _t == "Color":
				return ToColor(_v)
			elif _t == "NodePath":
				return ToNodePath(_v)
			elif _t == "Plane":
				return ToPlane(_v)
			elif _t == "Quat":
				return ToQuat(_v)
			elif _t == "Rect2":
				return ToRect2(_v)
			elif _t == "Transform":
				return ToTransform(_v)
			elif _t == "Transform2D":
				return ToTransform2D(_v)
			elif _t == "Vector2":
				return ToVector2(_v)
			elif _t == "Vector3":
				return ToVector3(_v)
			elif _t == "PoolByteArray":
				if _v.has(K_ARRAY):
					return ToPoolByteArray(_v[K_ARRAY])
				return PoolByteArray()
			elif _t == "PoolColorArray":
				if _v.has(K_ARRAY):
					return ToPoolColorArray(_v[K_ARRAY])
				return PoolColorArray()
			elif _t == "PoolIntArray":
				if _v.has(K_ARRAY):
					return ToPoolIntArray(_v[K_ARRAY])
				return PoolIntArray()
			elif _t == "PoolRealArray":
				if _v.has(K_ARRAY):
					return ToPoolRealArray(_v[K_ARRAY])
				return PoolRealArray()
			elif _t == "PoolStringArray":
				if _v.has(K_ARRAY):
					return ToPoolStringArray(_v[K_ARRAY])
				return PoolStringArray()
			elif _t == "PoolVector2Array":
				if _v.has(K_ARRAY):
					return ToPoolVector2Array(_v[K_ARRAY])
				return PoolVector2Array()
			elif _t == "PoolVector3Array":
				if _v.has(K_ARRAY):
					return ToPoolVector3Array(_v[K_ARRAY])
				return PoolVector3Array()
			elif ResourceLoader.exists(_t):
				return SetObject(ToVariant(_v), load(_t).new())
		return ToDictionary(_v)
	return _v


static func ToAABB(_d: Dictionary) -> AABB:
	return AABB(ToVector3(_d.position), ToVector3(_d.size))


static func ToArray(_a: Array) -> Array:
	for _i in range(_a.size()):
		_a[_i] = ToVariant(_a[_i])
	return _a


static func ToBasis(_d: Dictionary) -> Basis:
	return Basis(ToVector3(_d.x_axis), ToVector3(_d.y_axis), ToVector3(_d.z_axis))


static func ToColor(_d: Dictionary) -> Color:
	return Color(_d.r, _d.g, _d.b, _d.a)


static func ToDictionary(_d: Dictionary) -> Dictionary:
	for _k in _d.keys():
		_d[_k] = ToVariant(_d[_k])
	return _d


static func ToNodePath(_d: Dictionary) -> NodePath:
	return NodePath(_d.path)


static func ToPlane(_d: Dictionary) -> Plane:
	return Plane(ToVector3(_d.normal), _d.d)


static func ToPoolByteArray(_a: Array) -> PoolByteArray:
	return PoolByteArray(_a)


static func ToPoolColorArray(_a: Array) -> PoolColorArray:
	var _col := PoolColorArray()
	var _size := _a.size()
	_col.resize(_size)
	for _i in range(_size):
		_col[_i] = ToColor(_a[_i])
	return _col


static func ToPoolIntArray(_a: Array) -> PoolIntArray:
	return PoolIntArray(_a)


static func ToPoolRealArray(_a: Array) -> PoolRealArray:
	return PoolRealArray(_a)


static func ToPoolStringArray(_a: Array) -> PoolStringArray:
	return PoolStringArray(_a)


static func ToPoolVector2Array(_a: Array) -> PoolVector2Array:
	var _v2 := PoolVector2Array()
	_v2.resize(_a.size())
	for _i in range(_a.size()):
		_v2[_i] = ToVector2(_a[_i])
	return _v2


static func ToPoolVector3Array(_a: Array) -> PoolVector3Array:
	var _v3 := PoolVector3Array()
	var _size := _a.size()
	_v3.resize(_size)
	for _i in range(_size):
		_v3[_i] = ToVector3(_a[_i])
	return _v3


static func ToQuat(_d: Dictionary) -> Quat:
	return Quat(_d.x, _d.y, _d.z, _d.w)


static func ToRect2(_d: Dictionary) -> Rect2:
	return Rect2(ToVector2(_d.position), ToVector2(_d.size))


static func ToTransform(_d: Dictionary) -> Transform:
	return Transform(ToBasis(_d.basis), ToVector3(_d.origin))


static func ToTransform2D(_d: Dictionary) -> Transform2D:
	return Transform2D(ToVector2(_d.x), ToVector2(_d.y), ToVector2(_d.origin))


static func ToVector2(_d) -> Vector2:
	return Vector2(_d.x, _d.y)


static func ToVector3(_d: Dictionary) -> Vector3:
	return Vector3(_d.x, _d.y, _d.z)


# - - - - - - - - - - To Dictionaries - - - - - - - - - - 


static func FromVariant(_v):
	if not _v:
		return _v
	var _t = typeof(_v)
	if _t == TYPE_AABB:
		return FromAABB(_v)
	elif _t == TYPE_ARRAY:
		return FromArray(_v)
	elif _t == TYPE_BASIS:
		return FromBasis(_v)
	elif _t == TYPE_COLOR:
		return FromColor(_v)
	elif _t == TYPE_DICTIONARY:
		return FromDictionary(_v)
	elif _t == TYPE_INT_ARRAY:
		return FromPoolIntArray(_v)
	elif _t == TYPE_NODE_PATH:
		return FromNodePath(_v)
	elif _t == TYPE_OBJECT:
		var _d = {}
		var _class: String = _v.get_class()
		if _class == "Node":
			printerr("'Node' serialisation is unsupported. Consider serialise them manually.")
			return _d
		var _script: Script = _v.get_script()
		if _script:
			_d[K_TYPE] = _script.resource_path
		else:
			_d[K_TYPE] = _class
		for _type in _v.get_property_list():
			var _name = _type.name
			if _name in _v and _name != "script":
				_d[_name] = FromVariant(_v.get(_name))
		return _d
	elif _t == TYPE_PLANE:
		return FromPlane(_v)
	elif _t == TYPE_QUAT:
		return FromQuat(_v)
	elif _t == TYPE_RAW_ARRAY:
		return FromPoolByteArray(_v)
	elif _t == TYPE_REAL_ARRAY:
		return FromPoolRealArray(_v)
	elif _t == TYPE_RECT2:
		return FromRect2(_v)
	elif _t == TYPE_STRING_ARRAY:
		return FromPoolStringArray(_v)
	elif _t == TYPE_TRANSFORM:
		return FromTransform(_v)
	elif _t == TYPE_TRANSFORM2D:
		return FromTransform2D(_v)
	elif _t == TYPE_VECTOR2:
		return FromVector2(_v)
	elif _t == TYPE_VECTOR2_ARRAY:
		return FromPoolVector2Array(_v)
	elif _t == TYPE_VECTOR3:
		return FromVector3(_v)
	elif _t == TYPE_VECTOR3_ARRAY:
		return FromPoolVector3Array(_v)
	elif _t == TYPE_MAX:
		return null
	return _v


static func FromAABB(_v: AABB) -> Dictionary:
	return { K_TYPE: "AABB", position = FromVector3(_v.position), size = FromVector3(_v.size), }


static func FromArray(_v: Array) -> Array:
	for _i in range(_v.size()):
			_v[_i] = FromVariant(_v[_i])
	return _v


static func FromBasis(_v: Basis) -> Dictionary:
	return { K_TYPE: "Basis", x = FromVector3(_v.x), y = FromVector3(_v.y), z = FromVector3(_v.z), }


static func FromColor(_v: Color) -> Dictionary:
	return { K_TYPE: "Color", r = _v.r, g = _v.g, b = _v.b, a = _v.a, }


static func FromDictionary(_v: Dictionary) -> Dictionary:
	for _k in _v.keys():
		_v[_k] = FromVariant(_v[_k])
	return _v


static func FromNodePath(_v: NodePath) -> Dictionary:
	return { K_TYPE: "NodePath", path = String(_v), }


static func FromPlane(_v: Plane) -> Dictionary:
	return { K_TYPE: "Plane", normal = FromVector3(_v.normal), d = _v.d, }


static func FromPoolByteArray(_v: PoolByteArray) -> Dictionary:
	return { K_TYPE: "PoolByteArray", K_ARRAY: Array(_v), }


static func FromPoolColorArray(_col: PoolColorArray) -> Dictionary:
	var _a = Array(_col)
	for _i in range(_a.size()):
		_a[_i] = FromColor(_a[_i])
	return { K_TYPE: "PoolColorArray", K_ARRAY: _a, }


static func FromPoolIntArray(_v: PoolIntArray) -> Dictionary:
	return { K_TYPE: "PoolIntArray", K_ARRAY: Array(_v), }


static func FromPoolRealArray(_v: PoolRealArray) -> Dictionary:
	return { K_TYPE: "PoolRealArray", K_ARRAY: Array(_v), }


static func FromPoolStringArray(_v: PoolStringArray) -> Dictionary:
	return { K_TYPE: "PoolStringArray", K_ARRAY: Array(_v), }


static func FromPoolVector2Array(_v2: PoolVector2Array) -> Dictionary:
	var _a = Array(_v2)
	for _i in range(_a.size()):
		_a[_i] = FromVector2(_a[_i])
	return { K_TYPE: "PoolVector2Array", K_ARRAY: _a, }


static func FromPoolVector3Array(_v3: PoolVector3Array) -> Dictionary:
	var _a = Array(_v3)
	for _i in range(_a.size()):
		_a[_i] = FromVector3(_a[_i])
	return { K_TYPE: "PoolVector3Array", K_ARRAY: _a, }


static func FromQuat(_v: Quat) -> Dictionary:
	return { K_TYPE: "Quat", x = _v.x, y = _v.y, z = _v.z, w = _v.w, }


static func FromRect2(_v: Rect2) -> Dictionary:
	return { K_TYPE: "Rect2", position = _v.position, size = _v.size, }


static func FromTransform(_v: Transform) -> Dictionary:
	return { K_TYPE: "Transform", basis = FromBasis(_v.basis), origin = FromVector3(_v.origin), }


static func FromTransform2D(_v: Transform2D) -> Dictionary:
	return { K_TYPE: "Transform2D", x = _v.x, y = _v.y, origin = _v.origin, }


static func FromVector2(_v: Vector2) -> Dictionary:
	return { K_TYPE: "Vector2", x = _v.x, y = _v.y, }


static func FromVector3(_v: Vector3) -> Dictionary:
	return { K_TYPE: "Vector3", x = _v.x, _y = _v.y, }


# - - - - - - - - - - Serialise/Deserialise - - - - - - - - - - 


static func Serialise(_v) -> String:
	return JSON.print(FromVariant(_v))


static func _JsonParse(_v: String) -> Dictionary:
	var _res := JSON.parse(_v)
	if _res.error == OK:
		var _parsed = _res.result
		if typeof(_parsed) == TYPE_DICTIONARY:
			return _parsed
	return {}


static func DeserialiseTo(_v: String, _o: Object) -> void:
	SetObject(_JsonParse(_v), _o)


static func Deserialise(_v: String):
	var _dict := _JsonParse(_v)
	if _dict.empty():
		return null
	return ToVariant(_dict)

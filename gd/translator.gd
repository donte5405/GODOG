class_name Tr


#GODOG_IGNORE
const TR_QUOTE = "----- LOCALE -----"
#GODOG_IGNORE


static func Csv(_key: String) -> String:
	return Engine.tr(_key)


static func Dsk(_key: String) -> String:
	#GODOG_IGNORE
	if TR_QUOTE in _key:
		# Debug translation, quite slow.
		_key = _key.split(TR_QUOTE)[1].substr(1, _key.length() - 1)
		_key = ",".join(_key.split("\n"))
		var _json: Dictionary = JSON.parse("{" + _key + "}").result
		if _json.has(OS.get_locale_language()):
			return _json[OS.get_locale_language()]
		return _key
	#GODOG_IGNORE
	# Production translation.
	var _file := File.new()
	var _str: String = OS.get_locale_language() + "_" + _key
	var _path: String = "res://tr/" + _str.md5_text() + ".txt"
	if not _file.file_exists(_path):
		return _key
	_file.open(_path, File.READ)
	_str = _file.get_as_text()
	return _str

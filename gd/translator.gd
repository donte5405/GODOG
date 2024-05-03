class_name Tr


#GODOG_PRIVATE: _key, _json, _file, _str, _path


const TR_QUOTE = "_*_*_*_"


static func dsk(_key: String) -> String:
    if TR_QUOTE in _key:
        # Debug translation, quite slow.
        var _json: Dictionary = JSON.parse("{" + "".join(_key.split(TR_QUOTE)) + "}").result
        if _json.has(OS.get_locale_language()):
            return _json[OS.get_locale_language()]
        return _key
    # Production translation.
    var _file := File.new()
    var _str: String = OS.get_locale_language() + "_" + _key
    var _path: String = "res://tr/" + _str.md5_text() + ".txt"
    if not _file.file_exists(_path):
        return _key
    _file.open(_path, File.READ)
    _str = _file.get_as_text()
    return _str

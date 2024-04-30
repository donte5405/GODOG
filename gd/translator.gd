class_name Tr


const TR_QUOTE = "_*_*_*_"


static func dsk(str: String) -> String:
    if TR_QUOTE in str:
        # Debug translation, quite slow.
        var _json: Dictionary = JSON.parse("{" + "".join(str.split(TR_QUOTE)) + "}").result
        if _json.has(OS.get_locale_language()):
            return _json[OS.get_locale_language()]
        return _str
    # Production translation.
    var _file := File.new()
    var _str: String = OS.get_locale_language() + "_" + str
    var path: String = "res://tr/" + _str.md5_text() + ".txt"
    if not _file.file_exists(_path):
        return str
    _file.open()
    _str = _file.get_as_text()
    return _str

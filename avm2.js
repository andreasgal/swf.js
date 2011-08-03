/* -*- mode: javascript; tab-width: 4; insert-tabs-mode: nil; indent-tabs-mode: nil -*- */

var Stream = (function () {
    function constructor(bytes) {
        this.bytes = bytes;
        this.pos = 0;
    }

    var decode;
    var tmp;

    constructor.prototype = {
        remaining: function () {
            return this.bytes.length - this.pos;
        },
        readU8: function() {
            return this.bytes[this.pos++];
        },
        readU32: function() {
            var result = this.readU8();
            if (result & 0x80) {
                result = result & 0x7f | this.readU8() << 7;
                if (result & 0x4000) {
                    result = result & 0x3fff | this.readU8() << 14;
                    if (result & 0x200000) {
                        result = result & 0x1fffff | this.readU8() << 21;
                        if (result & 0x10000000)
                            result = result & 0x0fffffff | this.readU8() << 28;
                    }
                }
            }
            return result & 0xffffffff;
        },
        readU30: function() {
            return this.readU32();
        },
        readS32: function() {
            return this.readU32();
        },
        readWord: function() {
            return this.readU8() |
                   (this.readU8() << 8) |
                   (this.readU8() << 16) |
                   (this.readU8() << 24);
        },
        readDouble: function() {
            if (!decode) {
                // Setup the decode buffer for doubles.
                var b = ArrayBuffer(8);
                var i8 = Uint8Array(b);
                var i32 = Uint32Array(b);
                var f64 = Float64Array(b);
                i32[0] = 0x11223344;
                decode = ({ i32: i32, f64: f64, bigEndian: i8[0] == 0x11 });
            }
            if (decode.bigEndian) {
                decode.i32[0] = readWord();
                decode.i32[1] = readWord();
            } else {
                decode.i32[1] = readWord();
                decode.i32[0] = readWord();
            }
            return decode.f64[0];
        },
        readUTFString: function(length) {
            if (!tmp || tmp.length < length)
                tmp = Uint8Array(length);
            for (var i = 0; i < length; ++i)
                tmp[i] = this.readU8();
            var result = "";
            for (var i = 0; i < length; i++) {
                if (tmp[i] <= 0x7f) {
                    result += String.fromCharCode(tmp[i]);
                } else if (tmp[i] >= 0xc0) { // multibyte
                    var code;
                    if (tmp[i] < 0xe0) { // 2 bytes
                        code = ((tmp[i++] & 0x1f) << 6) |
                               (tmp[i] & 0x3f);
                    } else if (tmp[i] < 0xf0) { // 3 bytes
                        code = ((tmp[i++] & 0x0f) << 12) |
                               ((tmp[i++] & 0x3f) << 6) |
                               (tmp[i] & 0x3f);
                    } else { // 4 bytes
                        // turned into two characters in JS as surrogate pair
                        code = (((tmp[i++] & 0x07) << 18) |
                                ((tmp[i++] & 0x3f) << 12) |
                                ((tmp[i++] & 0x3f) << 6) |
                                (tmp[i] & 0x3f)) - 0x10000;
                        // High surrogate
                        result += String.fromCharCode(((code & 0xffc00) >>> 10) + 0xd800);
                        // Low surrogate
                        code = (code & 0x3ff) + 0xdc00;
                    }
                    result += String.fromCharCode(code);
                } // Otherwise it's an invalid UTF8, skipped.
            }
            return result;
        }
    };

    return constructor;
})();

const CONSTANT_Utf8               = 0x01;
const CONSTANT_Integer            = 0x03;
const CONSTANT_UInt               = 0x04;
const CONSTANT_PrivateNamespace   = 0x05;
const CONSTANT_Double             = 0x06;
const CONSTANT_QName              = 0x07; // ns::name, const ns, const name
const CONSTANT_Namespace          = 0x08;
const CONSTANT_Multiname          = 0x09; // [ns...]::name, const [ns...], const name
const CONSTANT_False              = 0x0A;
const CONSTANT_True               = 0x0B;
const CONSTANT_Null               = 0x0C;
const CONSTANT_QNameA             = 0x0D; // @ns::name, const ns, const name
const CONSTANT_MultinameA         = 0x0E; // @[ns...]::name, const [ns...], const name
const CONSTANT_RTQName            = 0x0F; // ns::name, var ns, const name
const CONSTANT_RTQNameA           = 0x10; // @ns::name, var ns, const name
const CONSTANT_RTQNameL           = 0x11; // ns::[name], var ns, var name
const CONSTANT_RTQNameLA          = 0x12; // @ns::[name], var ns, var name
const CONSTANT_NameL              = 0x13; // o[name], var name
const CONSTANT_NameLA             = 0x14; // @[name], var name
const CONSTANT_NamespaceSet       = 0x15;
const CONSTANT_PackageNamespace   = 0x16; // namespace for a package
const CONSTANT_PackageInternalNS  = 0x17;
const CONSTANT_ProtectedNamespace = 0x18;
const CONSTANT_ExplicitNamespace  = 0x19;
const CONSTANT_StaticProtectedNS  = 0x1A;
const CONSTANT_MultinameL         = 0x1B;
const CONSTANT_MultinameLA        = 0x1C;
const CONSTANT_ClassSealed        = 0x01;
const CONSTANT_ClassFinal         = 0x02;
const CONSTANT_ClassInterface     = 0x04;
const CONSTANT_ClassProtectedNs   = 0x08;

const TRAIT_Slot                  = 0;
const TRAIT_Method                = 1;
const TRAIT_Getter                = 2;
const TRAIT_Setter                = 3;
const TRAIT_Class                 = 4;
const TRAIT_Function              = 5;
const TRAIT_Const                 = 6;

const ATTR_Final                  = 0x01;
const ATTR_Override               = 0x02;
const ATTR_Metadata               = 0x04;

const SLOT_var                    = 0;
const SLOT_method                 = 1;
const SLOT_getter                 = 2;
const SLOT_setter                 = 3;
const SLOT_class                  = 4;
const SLOT_function               = 6;

const METHOD_Arguments            = 0x1;
const METHOD_Activation           = 0x2;
const METHOD_Needrest             = 0x4;
const METHOD_HasOptional          = 0x8;
const METHOD_IgnoreRest           = 0x10;
const METHOD_Native               = 0x20;
const METHOD_Setsdxns             = 0x40;
const METHOD_HasParamNames        = 0x80;

function parseAbcFile(b) {
    function checkMagic(b) {
        var magic = b.readWord();
        if (magic < (46<<16|15)) // Flash Player Brannan
            throw new Error("not an abc file. magic=" + Number(magic).toString(16));
    }
    function parseCpool(b) {
        var int32 = [];
        var uint32 = [];
        var float64 = [];
        var strings = [];
        var namespace = [];
        var namespaceset = [];
        var names = [];
        var i, n;

        // ints
        n = b.readU30();
        for (i = 1; i < n; ++i) {
            int32.push(b.readS32());
        }

        // uints
        n = b.readU30();
        for (i = 1; i < n; ++i)
            uint32.push(b.readU32());

        // doubles
        n = b.readU30();
        for ( i =1; i < n; ++i)
            float64.push(b.readDouble());

        // strings
        n = b.readU30();
        for (i = 1; i < n; ++i)
            strings.push(b.readUTFString(b.readU32()));

        // namespaces
        n = b.readU30();
        for (i = 1; i < n; ++i)
            namespace.push({ nskind: b.readU8(), uri: b.readU32() });

        // namespace sets
        n = b.readU30();
        for (i = 1; i < n; ++i) {
            var count = b.readU30();
            var nsset = [];
            for (var j = 0; j < count; ++j)
                nsset.push(b.readU30());
            namespaceset.push(nsset);
        }

        // multinames
        n = b.readU30();
        for (i = 1; i < n; ++i) {
            var kind = b.readU8();
            switch (kind) {
            case CONSTANT_QName: case CONSTANT_QNameA:
                names[i] = { ns: b.readU30(), name: b.readU30(), kind: kind };
                break;
            case CONSTANT_RTQName: case CONSTANT_RTQNameA:
                names[i] = { name: b.readU30(), kind: kind };
                break;
            case CONSTANT_RTQNameL: case CONSTANT_RTQNameLA:
                names[i] = { kind: kind };
                break;
            case CONSTANT_Multiname: case CONSTANT_MultinameA:
                var name = b.readU32();
                names[i] = { nsset: b.readU30(), name: name, kind: kind };
                break;
            case CONSTANT_MultinameL: case CONSTANT_MultinameLA:
                names[i] = { name: b.readU30(), kind: kind };
                break;
            }
        }

        return { int32: int32, uint32: uint32, float64: float64, strings: strings,
                 namespace: namespace, namespaceset: namespaceset, names: names };
    }
    function parseMethodInfo(b) {
        var paramcount = b.readU32();
        var returntype = b.readU32();
        var params = [];
        for (var i = 0; i < paramcount; ++i)
            params.push(b.readU32());

        var name = b.readU32();
        var flags = b.readU8();

        var optionalcount = 0;
        var optionals = null;
        if (flags & METHOD_HasOptional) {
            optionalcount = b.readU32();
            optionals = [];
            for (var i = 0; i < optionalcount; ++i)
                optionals[i] = { val: b.readU32(), kind:b.readU8() };
        }

        var paramnames = null;
        if (flags & METHOD_HasParamNames) {
            paramnames = [];
            for (var i = 0; i < paramcount; ++i)
                paramnames[i] = b.readU32();
        }

        return { name: name, params: params, returntype: returntype, flags: flags,
                 optionals: optionals, paramnames: paramnames };
    }
    function parseMetadataInfo(b) {
        var name = b.readU32();
        var itemcount = b.readU32();

        var items = [];
        for (var i = 0; i < itemcount; ++i)
            items[i] = { key: readU32(), value: readU32() };

        return { name: name, items: items };
    }
    function parseTrait(b) {
        var name = b.readU32();
        var tag = b.readU8();
        var kind = tag & 0x0F;
        var attrs = (tag>>4) & 0x0F;
        var trait;

        switch (kind) {
        case TRAIT_Slot:
        case TRAIT_Const:
            var slotid = b.readU32();
            var typename = b.readU32();
            var value = b.readU32();
            var kind = null;
            if (value != 0)
                kind = b.readU8();
            trait = { name: name, attrs: attrs, kind: kind, slotid: slotid,
                      typename: typename, value: value };
            break;
        case TRAIT_Method:
        case TRAIT_Setter:
        case TRAIT_Getter:
            var dispid = b.readU32();
            var methinfo = b.readU32();
            trait = { name: name, attrs: attrs, kind: kind, dispid: dispid,
                      methinfo: methinfo };
            break;
        case TRAIT_Class:
            var slotid = b.readU32();
            var classinfo = b.readU32();
            trait = { name: name, attrs: attrs, kind: kind, slotid: slotid,
                      classinfo: classinfo };
            break;
        case TRAIT_Function: // TODO
            b.readU32();
            b.readU32();
            break;
        }

        if (attrs & ATTR_Metadata) {
            var metadata = [];
            var metadatacount = b.readU32();
            for (var i = 0; i < metadatacount; ++i)
                metadata.push(b.readU32());
            trait.metadata = metadata;
        }

        return trait;
    }
    function parseTraits(b, target) {
        var traitcount = b.readU32();
        var traits = [];
        for (var i = 0; i < traitcount; ++i)
            traits.push(parseTrait(b));
        target.traits = traits;
    }
    function parseInstanceInfo(b) {
        var name = b.readU32();
        var superclass = b.readU32();
        var flags = b.readU8();
        var protectedNS = 0;
        if (flags & 8)
            protectedNS = b.readU32();

        var interfacecount = b.readU32();
        var interfaces = [];
        for (var i = 0; i < interfacecount; ++i)
            interfaces[i] = b.readU32();
        var iinit = b.readU32();
        var instance_info = { name: name, superclass: superclass, flags: flags,
                              protectedNS: protectedNS, interfaces: interfaces,
                              iinit: iinit };
        parseTraits(b, instance_info);
        return instance_info;
    }
    function parseClassInfo(b) {
        var cinit = b.readU32();
        var class_info = { cinit: cinit };
        parseTraits(b, class_info);
        return class_info;
    }
    function parseScriptInfo(b) {
        var script = { init: b.readU32() };
        parseTraits(b, script);
        return script;
    }
    function parseException(b) {
        return { start: b.readU32(), end: b.readU32(), target: b.readU32(),
                 typename: b.readU32(), name: b.readU32() };
    }
    function parseMethodBody(b) {
        var mb = { method: b.readU32(), maxStack: b.readU32(), localCount: b.readU32(),
                   initScopeDepth: b.readU32(), maxScopeDepth: b.readU32() };

        var code_len = b.readU32();
        var code = Uint8Array(code_len);
        for (var i = 0; i < code_len; ++i)
            code[i] = b.readU8();
        mb.code = code;

        var exceptions = [];
        var excount = b.readU32();
        for (var i = 0; i < excount; ++i)
            exceptions = parseException(b);
        mb.exceptions = exceptions;

        parseTraits(b, mb);
        return mb;
    }

    checkMagic(b);

    var constants = parseCpool(b);
    var methods = [];
    var metadata = [];
    var instances = [];
    var classes = [];
    var scripts = [];
    var methodBodies = [];
    var i, n;

    // MethodInfos
    n = b.readU32();
    for (i = 0; i < n; ++i)
        methods.push(parseMethodInfo(b));

    // MetaDataInfos
    n = b.readU32();
    for (i = 0; i < n; ++i)
        metadata.push(parseMetadata(b));

    // InstanceInfos
    n = b.readU32();
    for (i = 0; i < n; ++i)
        instances.push(parseInstanceInfo(b));

    // ClassInfos
    for (i = 0; i < n; ++i)
        classes.push(parseClassInfo(b));

    // ScriptInfos
    n = b.readU32();
    for (i = 0; i < n; ++i)
        scripts.push(parseScriptInfo(b));

    // MethodBodies
    n = b.readU32();
    for (i = 0; i < n; ++i)
        methodBodies.push(parseMethodBody(b));

    return { constants: constants, methods: methods, metadata: metadata, instances: instances,
             classes: classes, scripts: scripts, methodBodies: methodBodies };
}

function compileAbc(abc) {
    var methods = abc.methods;
    var scripts = abc.scripts;

    function resolve() {
        // Attach method bodies to their respective methods.
        var methodBodies = abc.methodBodies;
        var n = methodBodies.length;
        for (var i = 0; i < n; ++i) {
            var mb = methodBodies[i];
            methods[mb.method].body = mb;
        }
    }
    function compileBody(body) {
        var maxStack = body.maxStack;
        var localCount = body.localCount;
        var src = "";

        src += "function (scopeChain,";
        for (var i = 0; i < localCount; ++i)
            src += ("L" + i + ((i + 1 < localCount) ? "," : ""));
        src += ") {\n";
        src += "var "; // temporary
        for (var i = 0; i < maxStack; ++i)
            src += ("S" + i + ((i + 1 < maxStack) ? "," : ""));
        src += ";\n";

        function local(n) {
            return "L" + n;
        }

        var sp = 0;
        function push() {
            return "S" + (sp++);
        }
        function pop() {
            return "S" + (--sp);
        }

        function emit(code) {
            src += code;
            src += ";\n";
        }

        function assign(lval, rval) {
            emit(lval + "=" + rval);
        }

        var stream = new Stream(body.code);
        while (stream.remaining() > 0) {
            var op = stream.readU8();
            switch (op) {
            case 0x30: // pushscope
                emit("scopeChain.push(nullcheck(" + pop() + "))");
                break;
            case 0x40: // 
            case 0xD0: case 0xD1: case 0xD2: case 0xD3: // getlocalX
                assign(push(), local(op - 0xD0));
                break;
            case 0xD4: case 0xD5: case 0xD6: case 0xD7: // setlocalX
                assign(local(op - 0xD4), pop());
                break;
            default:
                print(src);
                throw new Error("not implemented: " + Number(op).toString(16));
            }
        }
        print(src);
    }
    resolve();
    var method = methods[scripts[0].init];
    var body = method.body;
    compileBody(body);
}

var bytes = snarf("tests/bitops-bits-in-byte.abc", "binary");
var abc = parseAbcFile(new Stream(bytes));
compileAbc(abc);

const RandomStringFormat = {
    BINARY: '01',
    OCTAL: '01234567',
    NUMERIC: '0123456789',
    HEXADECIMAL: '0123456789abcdef',
    ALPHA: 'abcdefghijklmnopqrstuvwxyz',
    ALPHA_NUMERIC: 'abcdefghijklmnopqrstuvwxyz0123456789',
    BASE64: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/',
    BASE64_URL: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+_'
};

function randomString(length, format=RandomStringFormat.BASE64_URL) {
    const fmt = format in RandomStringFormat ? RandomStringFormat(format) : format;
    
    let result = '';
    for (let i = 0; i < length; ++i) {
        result += fmt.charAt(Math.floor(Math.random() * fmt.length));
    }

    return result;
}

module.exports = {
    RandomStringFormat,
    randomString
};
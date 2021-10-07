const fs = require('fs');

module.exports = {
    ReadFileLSV: function(filename) {
        const content = fs.readFileSync(filename).toString();
        return content.split('\n')
            .filter(line => !!line.trim());
    },
    WriteFileLSV: function(filename, data) {
        let content = '';
        data.forEach(val => {
            content += `${val}\n`;
        });
    
        fs.writeFileSync(filename, content);
    }
}

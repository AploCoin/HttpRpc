const fs = require('fs');
const os = require('os');
const path = require('path');
const { compress, decompress } = require('node-zstandard');

function compressBuffer(inputBuffer, compLevel, callback) {
    const tempInputFile = path.join(os.tmpdir(), 'input.tmp');
    const tempOutputFile = path.join(os.tmpdir(), 'output.tmp');

    fs.writeFile(tempInputFile, inputBuffer, (err) => {
        if (err) return callback(err);

        compress(tempInputFile, tempOutputFile, compLevel, (err) => {
            if (err) return callback(err);

            fs.readFile(tempOutputFile, (err, compressedData) => {
                if (err) return callback(err);

                // Clean up temporary files
                fs.unlink(tempInputFile, () => {});
                fs.unlink(tempOutputFile, () => {});

                callback(null, compressedData);
            });
        });
    });
}

function decompressBuffer(inputBuffer, callback) {
    const tempInputFile = path.join(os.tmpdir(), 'input.tmp');
    const tempOutputFile = path.join(os.tmpdir(), 'output.tmp');

    fs.writeFile(tempInputFile, inputBuffer, (err) => {
        if (err) return callback(err);

        decompress(tempInputFile, tempOutputFile, (err) => {
            if (err) return callback(err);

            fs.readFile(tempOutputFile, (err, decompressedData) => {
                if (err) return callback(err);

                // Clean up temporary files
                fs.unlink(tempInputFile, () => {});
                fs.unlink(tempOutputFile, () => {});

                callback(null, decompressedData);
            });
        });
    });
}

module.exports.compressBuffer = compressBuffer;
module.exports.decompressBuffer = decompressBuffer;

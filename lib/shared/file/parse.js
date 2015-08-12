module.exports = function(type, contents, callback) {
    if( type == 'xlsx' ) {
        try {
            function onXlsxComplete(wb){
                selectWorksheet(wb.SheetNames, function(sheetName){
                    var csv = XLSX.utils.sheet_to_csv(wb.Sheets[sheetName]);
                    $.csv.toArrays(csv, {}, function(err, data){
                        if( err ) return callback(err);
                        callback(null, data);
                    });
                });
            }

            var worker = new Worker('bower_components/js-xlsx/xlsxworker.js');
            worker.onmessage = function(e) {
                switch(e.data.t) {
                    case 'ready': break;
                    case 'e': console.error(e.data.d); break;
                    case 'xlsx': onXlsxComplete(JSON.parse(e.data.d)); break;
                }
            };
            worker.postMessage({d:contents,b:true});

        } catch(e) {
            callback(e);
        }

    } else if( info.ext == 'xls' ) {
        try {
            function onXlsComplete(wb){
                selectWorksheet(wb.SheetNames, function(sheetName){
                    var csv = XLS.utils.sheet_to_csv(wb.Sheets[sheetName]);
                    $.csv.toArrays(csv, {}, function(err, data){
                        if( err ) return callback(err);
                        callback(null, data);
                    });
                });
            }

            var worker = new Worker('bower_components/js-xls/xlsworker.js');
            worker.onmessage = function(e) {
                switch(e.data.t) {
                    case 'ready': break;
                    case 'e': console.error(e.data.d); break;
                    case 'xlsx': onXlsComplete(JSON.parse(e.data.d)); break;
                }
            };
            worker.postMessage({d:contents,b:true});

        } catch(e) {
            debugger;
            this.onComplete(e, null, info, 1, 1, arr, callback);
        }
    } else {
        try {
            var options = {};
            //if( info.parser == 'csv-tab' ) options.separator = '\t';

            $.csv.toArrays(contents, options, function(err, data){
                if( err ) return callback(err);
                callback(null, data);
            }.bind(this));
        } catch(e) {
            debugger;
            this.onComplete(e, null, info, 1, 1, arr, callback);
        }
    }
}

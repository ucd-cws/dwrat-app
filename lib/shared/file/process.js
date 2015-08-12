var parse = require('./parse');
var previousAttrMap = {};

var file, map;

module.exports.init = function(options) {
  file = options.file;
  map = options.map;
};

// process a file
module.exports.run = function(e) {
  e.stopPropagation();
  e.preventDefault();
  var files = e.dataTransfer ? e.dataTransfer.files : e.target.files; // FileList object.

  if( files.length > 0 ) {
    $('#file-locate').html('Loading file...');
    read(files[0], function(err, data){
      $('#file-locate').html('');
      matchCols(data, function(colMap){
        // now locate data and create
        file.createGeoJson(data, colMap, function(){

          $('#date-selection').hide();
          $('#file-selection').html(files[0].name+' <a class="btn btn-default" id="remove-file-btn"><i class="fa fa-times"></i></a>');

          $('#remove-file-btn').on('click',function(){
            map.clearGeojsonLayer();
            $('#date-selection').show();
            $('#file-selection').html('');
          });

          $('#file-input').val('');
          $('#file-modal').modal('hide');
        });
      });
    });
  }
};

function read(raw, callback) {
    _resetUI();

    var type = 'text';

    var reader = new FileReader();
    reader.onload = function(e) {
        parse(type, e.target.result, callback);
    };

    if( raw.name.match(/.*\.xlsx?$/) ) {
        type = raw.name.replace(/.*\./,'');
        reader.readAsBinaryString(raw);
    } else {
        reader.readAsText(raw);
    }
}

function matchCols(data, callback) {
    if( data.length == 0 ) return alert('Your file is empty');

    var matches = [];
    var requiredMismatches = [];
    var mapped = previousAttrMap;

    var flatten = [];
    for( var i = 0; i < data[0].length; i++ ) {
      flatten.push(data[0][i].toLowerCase());
    }

    for( var key in file.HEADERS ) {
        if( previousAttrMap[key] ) {
            matches.push(key);
        } else if( flatten.indexOf(key) == -1 && file.HEADERS[key].required ) {
            requiredMismatches.push(key);
        } else if( flatten.indexOf(key) > -1 ) {
            matches.push(key);
        }
    }

    if( requiredMismatches.length == 0 ) return callback(previousAttrMap);

    var table = '<table class="table">';
    for( var i = 0; i < requiredMismatches.length; i++ ) {
        table += '<tr><td>'+requiredMismatches[i]+'</td><td>'+_createMatchSelector(requiredMismatches[i], data[0], matches)+'</td></tr>';
    }
    table += '</table>';

    $('#matchTable').html('<div style="margin-top:20px;font-weight:bold">Please match the following required columns to continue</div>'+table);
    $('.match-selector').on('change', function(){
        var key = $(this).attr('key');
        var val = $(this).val();

        if( val == '' || !val ) {
            delete mapped[key];
            requiredMismatches.push(key);
        } else {
            mapped[key] = val;
            var index = requiredMismatches.indexOf(key);
            if (index > -1) requiredMismatches.splice(index, 1);
        }


        if( requiredMismatches.length == 0 ) {
            $('#matchTable').html('');
            previousAttrMap = mapped;
            callback(mapped);
        }
    });
}


function _resetUI() {
    $('#matchTable').html('');
    $('#file-locate').html('');
}

function _createMatchSelector(key, arr, matches) {
    var select = '<select class="match-selector" key="'+key+'"><option></option>';

    for( var i = 0; i < arr.length; i++ ) {
        if( matches.indexOf(arr[i]) > -1 ) continue;
        select += '<option value="'+arr[i]+'">'+arr[i]+'</option>';
    }
    return select + '</select>';
}

function selectWorksheet(sheetNames, callback) {
    console.log(sheetNames);

    if( sheetNames.length == 1 ) callback(sheetNames[0]);

    // add UI interaction here
    callback(sheetNames[0]);
}

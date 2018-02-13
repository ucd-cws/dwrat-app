var files = [];

var public_dir_root = 'https://docs.google.com/spreadsheets/d/1ACi7P0pOy-JRjtw6HribQphhEOZ-0-CkQ_mqnyCfJcI/gviz/tq';
var popup, body, file, map, toast;

function init(config) {
  file = config.file;
  map = config.map;

  var query = new google.visualization.Query(public_dir_root);
  query.send(onInitLoad);

  popup = $('#directory-modal').modal({show: false});
  body = $('#directory-modal-body');

  $('#directory-btn').on('click', function(){
    popup.modal('show');
  });

  toast = $('<div style="display:none;position:fixed;left:10px; bottom: 50px" class="animated fadeInUp" id="toast"><div class="alert alert-success"><i class="fa fa-spinner fa-spin"></i> Loading File...</div></div>');
  $('body').append(toast);
}

function getQueryVariable(variable) {
    /*
      Shamelessly from https://stackoverflow.com/a/2091331/587938
      Parses query parameters to make them accessible from the application
     */
    var query = window.location.search.substring(1);
    var vars = query.split('&');
    for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split('=');
        if (decodeURIComponent(pair[0]) == variable) {
            return decodeURIComponent(pair[1]);
        }
    }
    return null;
    console.log('Query variable %s not found', variable);
}

function loadFileByID(files, id){
    /*
        Given the ID number of a file in the public directory, loads it up!
     */
    var file = files[parseInt(id)];
    load(file.Region+' '+getDates(file), file.ID);
}

function onInitLoad(resp) {
    /*
      This function intializes the public directory table and sets up the listening events when one is clicked.
      In Feb 2018, Nick added code to the end that made it so that with a URL parameter we can cause a file to autoload
   */
    if (resp.isError()) {
        alert('Error in loading public directory listing: ' + response.getMessage() + ' ' + response.getDetailedMessage());
        return;
    }

    var data = resp.getDataTable();
    var rowLen = data.getNumberOfRows();
    var colLen = data.getNumberOfColumns();

    var table = '<h4>Select File to Load</h4><table class="table">';
    table += '<tr><th>Filename</th><th>Start Date</th><th>End Date</th><td></td></tr>';
    for( var i = 0; i < rowLen; i++ ) {
        var file = {};
        for( var j = 0; j < colLen; j++ ) {
            file[data.getColumnLabel(j)] = data.getValue(i, j);
        }

        table += fileToRow(file, i);

        files.push(file);
    }

    // Set up the event handlers for clicking on items in the directory listing.
    body
        .html(table+'</table>')
        .find('a[index]')
        .on('click', function(){
            loadFileByID(files, $(this).attr('index'));
            popup.modal('hide');
        });

    // URL parameter reading and loading

    var region_load = getQueryVariable("region");
    if (region_load !== null){
        loadFileByID(files, region_load);
    }
}


function getDates(file) {
  if( !file['Start Date'] || !file['End Date'] ) return '';

  var txt = '(';
  txt += file['Start Date'] ? toDate(file['Start Date']) : '?';
  txt += ' - ';
  txt += file['End Date'] ? toDate(file['End Date']) : '?';
  return txt + ')';

}

function load(name, id) {
  toast.show();

  var query = new google.visualization.Query('https://docs.google.com/spreadsheets/d/'+id+'/gviz/tq');
  query.send(function(resp){
    if (resp.isError()) {
      toast.hide();
      alert('Error in loading public sheet: ' + response.getMessage() + ' ' + response.getDetailedMessage());
      return;
    }

    var data = resp.getDataTable();
    var rowLen = data.getNumberOfRows();
    var colLen = data.getNumberOfColumns();
    var csv = [[]];


    for( var i = 0; i < colLen; i++ ) {
      csv[0].push(data.getColumnLabel(i));
    }

    for( var i = 0; i < rowLen; i++ ) {
      var row = [];
      for( var j = 0; j < colLen; j++ ) {
        row.push(data.getValue(i, j));
      }
      csv.push(row);
    }

    file.process.setFilename(name);
    file.process.onFileParsed(null, csv);
  });
}

function fileToRow(file, index) {
  return '<tr>' +
    '<td><a class="btn btn-link" index="'+index+'"><i class="fa fa-download"></i> '+file.Region+'</a></td>'+
    '<td>'+getDate(file['Start Date'])+'</td>'+
    '<td>'+getDate(file['End Date'])+'</td>'+
    '<td><a class="btn btn-link" href="https://docs.google.com/spreadsheets/d/'+file.ID+'" target="_blank"><i class="fa fa-table"></i></a></td>'+
  '</tr>';
}

function getDate(d) {
  if( !d ) return '?';
  return toDate(d);
}

function toDate(d) {
  return (d.getYear()+1900)+'-'+(d.getMonth()+1)+'-'+d.getDate();
}

module.exports = {
  init : init
};

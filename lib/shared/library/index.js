var files = [];

var root = 'https://docs.google.com/spreadsheets/d/1ACi7P0pOy-JRjtw6HribQphhEOZ-0-CkQ_mqnyCfJcI/gviz/tq';
var popup, body, file, map, toast;

function init(config) {
  file = config.file;
  map = config.map;

  var query = new google.visualization.Query(root);
  query.send(onInitLoad);

  popup = $('#directory-modal').modal({show: false});
  body = $('#directory-modal-body');

  $('#directory-btn').on('click', function(){
    popup.modal('show');
  });

  toast = $('<div style="display:none;position:fixed;left:10px; bottom: 50px" class="animated fadeInUp" id="toast"><div class="alert alert-success"><i class="fa fa-spinner fa-spin"></i> Loading File...</div></div>');
  $('body').append(toast);
}

function onInitLoad(resp) {
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

  body
    .html(table+'</table>')
    .find('a[index]')
    .on('click', function(){
      var file = files[parseInt($(this).attr('index'))];
      load(file.Region+' '+getDates(file), file.ID);
      popup.modal('hide');
    });
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

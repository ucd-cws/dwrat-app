var PublicData = (function(){

  var files = [];

  var root = 'https://docs.google.com/spreadsheets/d/1ACi7P0pOy-JRjtw6HribQphhEOZ-0-CkQ_mqnyCfJcI/gviz/tq';

  function init(resp) {
    var query = new google.visualization.Query(root);
    query.send(onInitLoad);
  }

  function onInitLoad(resp) {
    if (resp.isError()) {
      alert('Error in loading public data: ' + response.getMessage() + ' ' + response.getDetailedMessage());
      return;
    }

    var data = resp.getDataTable();
    var rowLen = data.getNumberOfRows();
    var colLen = data.getNumberOfColumns();


    for( var i = 0; i < rowLen; i++ ) {
      var file = {};
      for( var j = 0; j < colLen; j++ ) {
        file[data.getColumnId(j)] = data.getValue(i, j);
      }
      files.push(file);
    }

    console.log(files);
  }

  return {
    init : init
  };

})();

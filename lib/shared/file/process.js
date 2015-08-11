module.exports = function(e, file) {
  e.stopPropagation();
  e.preventDefault();
  var files = e.dataTransfer ? e.dataTransfer.files : e.target.files; // FileList object.

  if( files.length > 0 ) {
    $('#file-locate').html('Loading file...');
    file.read(files[0], function(err, data){
      $('#file-locate').html('');
      file.matchCols(data, function(colMap){
        // now locate data and create
        file.createGeoJson(data, colMap, function(){

          $('#date-selection').hide();
          $('#file-selection').html(files[0].name+' <a class="btn btn-default" id="remove-file-btn"><i class="fa fa-times"></i></a>');
          $('#remove-file-btn').on('click',function(){
            if( geoJsonLayer ) map.removeLayer(geoJsonLayer);
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

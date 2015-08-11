var selected = null;

module.exports.select = function(marker) {
  if( selected !== null ) {
    selected.setStyle({
      color : '#333',
      weight : 1
    });
    if( selected.redraw ) selected.redraw();
  }

  if( marker ) {
    marker.setStyle({
      color : '#ff0000',
      weight : 2
    });
    if( marker.redraw ) marker.redraw();
  }

  selected = marker;
};

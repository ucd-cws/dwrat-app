var data = {
  selected : null,
  hovered : null
};
var layer;

module.exports.init = function(l) {
  layer = l;
};

module.exports.hover = function(markers) {
  update('hovered', 'hover', markers);
};

module.exports.nohover = function(markers) {
  if( !data.hovered ) return;

  for( var i = 0; i < markers.length; i++ ) {
    var index = data.hovered.indexOf(markers[i]);
    if( index > -1 ) data.hovered[index].properties._render.hover = false;
  }

  layer.render();
};

module.exports.select = function(markers) {
  update('selected', 'highlight', markers);
};

function update(array, property, markers) {
  if( data[array] !== null ) {
    data[array].forEach(function(marker){
      marker.properties._render[property] = false;
    });
  }

  if( markers ) {
    data[array] = markers;
    markers.forEach(function(marker){
      marker.properties._render[property] = true;
    });
  }

  if( layer ) {
    layer.render();
  }
}

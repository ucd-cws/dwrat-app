(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.DWRAT = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/file/index.js":[function(require,module,exports){
var setup = require('./setup');
var process = require('./process');

var HEADERS = {
    application_number : {
        required : true,
        type : 'string'
    },
    demand_date : {
        required : true,
        type : 'date-string'
    },
    watershed : {
        required : false,
        type : 'string'
    },
    season : {
        required : false,
        type : 'boolean',
    },
    'HUC-12' : {
        required : false,
        type : 'boolean'
    },
    water_right_type : {
        required : false,
        type : 'string'
    },
    priority_date : {
        required : true,
        type : 'date-string'
    },
    riparian : {
        required : false,
        type : 'boolean'
    },
    pre1914 : {
        required : false,
        type : 'boolean'
    },
    demand : {
        required : true,
        type : 'float'
    },
    allocation : {
        required : true,
        type : 'float'
    }
};

var previousAttrMap = {};
var locations = {};

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

function _resetUI() {
    $('#matchTable').html('');
    $('#file-locate').html('');

}

function matchCols(data, callback) {
    if( data.length == 0 ) return alert('Your file is empty');

    var matches = [];
    var requiredMismatches = [];
    var mapped = previousAttrMap;

    for( var key in HEADERS ) {
        if( previousAttrMap[key] ) {
            matches.push(key);
        } else if( data[0].indexOf(key) == -1 && HEADERS[key].required ) {
            requiredMismatches.push(key);
        } else if( data[0].indexOf(key) > -1 ) {
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

function _createMatchSelector(key, arr, matches) {
    var select = '<select class="match-selector" key="'+key+'"><option></option>';

    for( var i = 0; i < arr.length; i++ ) {
        if( matches.indexOf(arr[i]) > -1 ) continue;
        select += '<option value="'+arr[i]+'">'+arr[i]+'</option>';
    }
    return select + '</select>';
}

function getAttrCol(attr, data, map) {
    if( map[attr] ) return data[0].indexOf(map[attr]);
    return data[0].indexOf(attr);
}

function selectWorksheet(sheetNames, callback) {
    console.log(sheetNames);

    if( sheetNames.length == 1 ) callback(sheetNames[0]);

    // add UI interaction here
    callback(sheetNames[0]);
}

function parse(type, contents, callback) {
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

function createGeoJson(data, attrMap, callback) {
    // first locate data
    $('#file-locate').html('Locating data...');

    var ids = [];
    var col = getAttrCol('application_number', data, attrMap);
    for( var i = 1; i < data.length; i++ ) {
        var id = data[i][col];
        if( !locations[id] ) ids.push(data[i][col]);
    }

    _locateData(0, ids, function(){

        $('#file-locate').html('Creating data...');

        var iMap = {};
        for( var key in attrMap ) iMap[attrMap[key]] = key;

        var geoJson = [];
        for( var i = 1; i < data.length; i++ ) {
            if( !locations[data[i][col]] ) continue;

            var p = {
                type : 'Feature',
                geometry : $.extend({}, true, locations[data[i][col]]),
                properties : {}
            }

            for( var j = 0; j < data[0].length; j++ ) {
                var key = data[0][j];
                if( iMap[key] ) key = iMap[key];
                p.properties[key] = (HEADERS[key] && HEADERS[key].type == 'float') ? parseFloat(data[i][j]) : data[i][j];
            }

            p.properties.allocations = [{
                season : true,
                allocation : p.properties.allocation,
                demand : p.properties.demand,
                forecast : false,
                date : p.properties.demand_date,
                public_health_bind : false,
                wrbind : false,
                ratio : (p.properties.demand > 0) ? (p.properties.allocation / p.properties.demand) : 0
            }];

            geoJson.push(p);
        }

        if( geoJsonLayer ) map.removeLayer(geoJsonLayer);
        allData = [];
        lastRespPoints = geoJson;
        addGeoJson(geoJson);
        $('#file-locate').html('');
        callback();
    });
}

function _locateData(index, ids, callback) {
    if( index+1 >= ids.length ) {
        callback();
    } else {
        var idGroup = [];

        var i = 0;
        for( i = index; i < index+200; i++ ) {
            if( ids.length == i ) break;
            idGroup.push(ids[i]);
        }
        index += 200;
        console.log(index);



        var query = new google.visualization.Query('http://watershed.ice.ucdavis.edu/vizsource/rest?view=locate(\''+
            idGroup.join(',')+'\')&tq=SELECT *');
        query.send(function(resp){
            if( resp.isError() ) {
                console.log(resp.getMessage());
            } else {
                var dt = resp.getDataTable();
                for( var i = 0; i < dt.getNumberOfRows(); i++ ) {
                    locations[dt.getValue(i, 0)] = JSON.parse(dt.getValue(i, 2));
                };
            }

            $('#file-locate').html('Locating data '+((index/ids.length).toFixed(2)*100)+'%...');
            _locateData(index, ids, callback);
        });
    }
}

// TODO
function _postQuery(view, query, callback) {
    $.ajax({
        type : 'POST',
        url : 'http://watershed.ice.ucdavis.edu/vizsource/rest',
        data : {
            view : view,
            tq : query,
            tqx: 'reqId:1'
        },
        dataType : 'text',
        success : function(body) {
            // clean and eval (remember this is not json...)
            var obj = eval('('+(body.replace(/google.visualization.Query.setResponse\(/,'').replace(/\);$/,''))+')');
            callback(null, new google.visualization.QueryResponse(obj));
        },
        error : function(resp, status) {
            callback(status);
        }
    });
}

module.exports = {
  setup : setup,
  process : function(e) {
    process(e, this);
  },
  read : read,
  matchCols : matchCols,
  getAttrCol : getAttrCol,
  createGeoJson : createGeoJson
};

},{"./process":"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/file/process.js","./setup":"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/file/setup.js"}],"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/file/process.js":[function(require,module,exports){
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

},{}],"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/file/setup.js":[function(require,module,exports){
module.exports = function() {
  $('#close-popup').on('click', function(){
    $('#info').removeClass('fadeInDown').addClass('slideOutRight');

    select(null);
    setTimeout(function(){
      $('#info').hide().addClass('fadeInDown').removeClass('slideOutRight');
    }, 800);
  });

  // file upload stuff
  $('#file-modal').modal({show:false});
  $('#file-input').on('change', function(e) {
    processFile(e);
  });
  $('#upload-btn').on('click', function(){
    $('#file-modal').modal('show');
  });

  $('body').on('dragover', function(e){
    e.preventDefault();
        e.stopPropagation();

    $('#upload-drop-message').show();
    $('#wrapper').css('opacity', 0.3);
  }).on('dragleave', function(e){
    e.preventDefault();
        e.stopPropagation();

    $('#upload-drop-message').hide();
    $('#wrapper').css('opacity',1);
  }).on('drop', function(e){
    $('#upload-drop-message').hide();
    $('#wrapper').css('opacity',1);

    processFile(e.originalEvent);
    $('#file-modal').modal('show');

  });
};

},{}],"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/huc/index.js":[function(require,module,exports){
var map;
var layers = [];
var pointsByHuc = {};
var urlPrefix = 'http://watershed.ice.ucdavis.edu/vizsource/rest?view=get_huc_by_id(\'';
var urlPostix = '\')&tq=SELECT *';

var hucCache = {};
var requested = {};

var showing = true;
var currentPoints = null;

function init(m) {
  map = m;

  $('#renderHucAvg').on('change', function(){
    showing = $(this).is(':checked');
    onVisibilityUpdate(showing);
  });
}

function onVisibilityUpdate() {
  if( !showing ) {
    clear();
  } else if( currentPoints !== null ){
    render(currentPoints);
  }
}

function clear() {
  // clear all layers
  for( var i = 0; i < layers.length; i++ ) {
    map.removeLayer(layers[i]);
  }
  layers = [];
  pointsByHuc = {};
}

function render(points) {
  currentPoints = points;
  if( !showing ) return;

  clear();

  // organize points by huc
  var huc;
  for( var i = 0; i < currentPoints.length; i++ ) {
    // TODO: did quinn change this?
    huc = points[i].properties['HUC-12'] || points[i].properties.huc_12;

    if( pointsByHuc[huc] ) pointsByHuc[huc].push(points[i]);
    else pointsByHuc[huc] = [points[i]];
  }

  // request missing huc geojson and/or render huc
  for( var huc in pointsByHuc ) {
    if( huc === undefined || huc === 'undefined' ) debugger;

    if( hucCache[huc] ) renderHuc(huc);
    else if( !requested[huc] ) request(huc);
  }
}

function request(hucId) {
  requested[hucId] = 1;

  var query = new google.visualization.Query(urlPrefix+hucId+urlPostix);
  query.setTimeout(60*5); // 5 min timeout
  query.send(function(response){
    if (response.isError() ) return alert('Error retrieving HUC 12 data for id "'+hucId+'"');

    var data = response.getDataTable();

    if( data.getNumberOfRows() == 0 ) {
      debugger;
      return alert('Error: invalid HUC 12 id "'+hucId+"'");
    }

    var geometry = JSON.parse(data.getValue(0, 0));
    var geojsonFeature = {
      "type": "Feature",
      "properties": {
          "id": hucId,
      },
      "geometry": geometry
    };
    hucCache[hucId] = geojsonFeature;

    renderHuc(hucId);
  });
}

function renderHuc(id) {
  if( !showing ) return;

  var points = pointsByHuc[id];

  // calculate percent demand
  var percentDemands = [], feature;
  for( var i = 0; i < points.length; i++ ) {
    feature = points[i];

    if( feature.properties.allocations && feature.properties.allocations.length > 0 ) {
      var demand = feature.properties.allocations[0].demand;
      var allocation = feature.properties.allocations[0].allocation;

      if( demand != 0 ) {
        percentDemands.push(allocation / demand);
      }
    }
  }

  // calc average
  var avgPrecentDemand = -1;
  var tmp = 0;
  for( var i = 0; i < percentDemands.length; i++ ) {
    tmp += percentDemands[i];
  }
  if( percentDemands.length > 0 ) avgPrecentDemand = tmp / percentDemands.length;

  var layer = L.geoJson(
    hucCache[id],
    {
      style: function(feature) {
        return renderPercentDemandHuc(avgPrecentDemand);
      }
    }
  ).addTo(map);

  layers.push(layer);
}

module.exports = {
  init : init,
  render : render
};

},{}],"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/index.js":[function(require,module,exports){

var map, geoJsonLayer;
var wmsLayers = [];
var allData = [];

// should be filled or empty;
var renderDemand = 'empty';
var currentPoints = null;
var lastRespPoints = null;

var map = require('./map');
var huc = require('./huc');
var file = require('./file');

$(document).on('ready', function(){
  resize();
  init();
});

$(window)
  .on('resize', resize);

function init() {
  map.init();
  huc.init(map.getLeaflet());

  file.setup(); // setup dom handlers for file

  map.legend.init();
  map.setHuc(huc);
}

function resize() {
  // why is this not working???
  //$('#map').height($(window).height())
  //     .width($(window).width());

  var h = window.innerHeight;
  var w = window.innerWidth;
  if( h === null ) h = $(window).height();
  if( w === null ) w = $(window).width();

  $('#map').height(h).width(w);
  $('#info').css('max-height', (h-85)+'px');
}

module.exports = {
  map : map,
  huc : huc,
  file : file
};

},{"./file":"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/file/index.js","./huc":"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/huc/index.js","./map":"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/map/index.js"}],"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/legend/index.js":[function(require,module,exports){
var DroughtIcon = require('../markers/droughtIcon');
var markerConfig = require('../markers/config');
var markers = markerConfig.defaults;
var map;

module.exports.init = function(m) {
  map = m;

  var demandSteps = [0, 1, 50, 100, 250];

  var options = $.extend(true, {}, markers.riparian.unallocated);
  options.sides = 0;
  var icon = new DroughtIcon(options);
  $('#legend-riparian').append($(icon.ele));


  options = $.extend(true, {}, markers.application.unallocated);
  options.sides = 3;
  options.rotate = 90;
  icon = new DroughtIcon(options);
  $('#legend-pre-appropriative').append($(icon.ele));

  icon = new DroughtIcon(markers.application.unallocated);
  $('#legend-post-appropriative').append($(icon.ele));

  var table = '<table style="text-align:center"><tr style="vertical-align: bottom">';
  var icons = [];
  for( var i = 0; i < demandSteps.length; i++ ) {
    table += '<td style="padding:4px"><div id="legend-demand-'+i+'"></div><div>'+
              (demandSteps[i] == 1 ? '<' : '') +
              (demandSteps[i] == 250 ? '>' : '') +
              demandSteps[i]+'</div></td>';


    if( demandSteps[i] === 0 ) {
      options = $.extend(true, {}, markers.application.unallocated);
      options = $.extend(true, options, markers.noDemand);
    } else {
      options = $.extend(true, {}, markers.application.unallocated);

      var size = Math.sqrt(demandSteps[i]) * 3;
      if( size > 50 ) size = 50;
      if( size < 7 ) size = 7;

      options.height = (size*2)+2;
      options.width = (size*2)+2;
    }

    icons.push(new DroughtIcon(options));
  }
  $('#legend-demand').html(table+'</tr></table>');

  for( i = 0; i < icons.length; i++ ) {
    $('#legend-demand-'+i).append($(icons[i].ele));
  }

  this.redrawPDemandLegend();

  // init toggle button

  $('#legendToggle').on('click', function(){
    if( this.hasAttribute('showing') ) {
      this.removeAttribute('showing');
      $('#legend').hide('slow');
      this.innerHTML = '<i class="fa fa-arrow-right"></i>';

    } else {
      this.setAttribute('showing', '');
      $('#legend').show('slow');
      this.innerHTML = '<i class="fa fa-arrow-down"></i>';
    }
  });

  $('#renderTypeFilled').on('click', onRenderTypeChange);
  $('#renderTypeEmpty').on('click', onRenderTypeChange);

  $('#showNoDemand').on('click', function(){
    if( geoJsonLayer ) {
      map.removeLayer(geoJsonLayer);
      geoJsonLayer = null;
      allData = [];
    }

    addGeoJson(lastRespPoints);
  });
};

module.exports.redrawPDemandLegend = function() {
  var percentSteps = [0, 25, 50, 75, 100], i;

  var table = '<table style="text-align:center"><tr style="vertical-align: bottom">';
  var icons = [];
	for( i = 0; i < percentSteps.length; i++ ) {
		table += '<td style="padding:8px"><div id="legend-precent-of-demand-'+i+'"></div><div>'+
					percentSteps[i]+'%</div></td>';

		var options = $.extend(true, {}, markers.application.unallocated);

    markerConfig.percentDemand(options, percentSteps[i] / 100);

		icons.push(new DroughtIcon(options));
	}
	$('#legend-precent-of-demand').html(table+'</tr></table>');

	for( i = 0; i < icons.length; i++ ) {
		$('#legend-precent-of-demand-'+i).append($(icons[i].ele));
	}
};

function onRenderTypeChange() {
  var isFilledChecked = $('#renderTypeFilled').is(':checked');
  var newVal = isFilledChecked ? 'filled' : 'empty';

  if( renderDemand == newVal ) return;
  renderDemand = newVal;

  // render legend
  this.redrawPDemandLegend();

  if( !currentPoints ) return;

  if( geoJsonLayer ) {
    map.removeLayer(geoJsonLayer);
    geoJsonLayer = null;
    allData = [];
  }
  map.addGeoJson(currentPoints);
};

function stamp(data) {
  var template = markerTemplate;
  for( var key in data ) template = template.replace('{{'+key+'}}', data[key]);
  return template;
}

},{"../markers/config":"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/markers/config.js","../markers/droughtIcon":"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/markers/droughtIcon.js"}],"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/map/geojson.js":[function(require,module,exports){
var markerConfig = require('../markers/config');

var geoJsonLayer;
var map, huc;

module.exports.init = function(config) {
  map = config.map;
  huc = config.huc;
};

module.exports.add = function(points) {
  var showNoDemand = $('#showNoDemand').is(':checked');

  if( !showNoDemand ) {
    tmp = [];
    for( var i = points.length-1; i >= 0; i-- ) {
      if( points[i].properties.allocations && points[i].properties.allocations.length > 0 ) {

        var demand = points[i].properties.allocations[0].demand;
        if( demand !== 0 ) tmp.push(points[i]);
      }
    }
    points = tmp;
  }

  geoJsonLayer = L.geoJson(points,{
    pointToLayer: function (feature, latlng) {
      var type = feature.properties.riparian ? 'riparian' : 'application';
      var allocation = 'unallocated';

      for( var i = 0; i < feature.properties.allocations.length; i++ ) {
        if( feature.properties.allocations[i].allocation > 0 ) allocation = 'allocated';
      }


      var options = $.extend(true, {}, markers[type][allocation]);

      if( feature.properties.allocations && feature.properties.allocations.length > 0 ) {

        var demand = feature.properties.allocations[0].demand;
        var allocation = feature.properties.allocations[0].allocation;

        if( demand === 0 ) {

          $.extend(true, options, markers.noDemand);
          feature.properties.noDemand = true;

        } else {
          markerConfig.renderPercentDemand(options, allocation / demand);

          var size = Math.sqrt(demand) * 3;
          if( size > 50 ) size = 50;
          if( size < 7 ) size = 7;

          options.height = size*2;
          options.width = size*2;
        }
      }



      var marker;
      var d;
      try {
        d = feature.properties.priority_date ? parseInt(feature.properties.priority_date.replace(/-.*/,'')) : 2000;
      } catch(e) {
        d = 2000;
      }

      if( feature.properties.riparian ) {
        options.sides = 0;
        marker = L.leafletMarker(latlng, options);
      } else if ( d < 1914 ) {
        options.sides = 3;
        options.rotate = 90;
        marker = L.leafletMarker(latlng, options);
      } else {
        marker = L.leafletMarker(latlng, options);
      }

      allData.push({
        feature : feature,
        marker  : marker
      });
      return marker;
    }
  }).addTo(map);

  geoJsonLayer.on('click', function(e) {
    $('.select-text').remove();
    $('#info').show();
    var props = e.layer.feature.properties;

    select(e.layer);

    var ll = e.layer.feature.geometry.coordinates;

    var t, html = '';
    for( var i = 0; i < allData.length; i++ ) {
      t = allData[i].feature.geometry.coordinates;
      if( ll[0].toFixed(4) == t[0].toFixed(4) && ll[1].toFixed(4) == t[1].toFixed(4) ) {
        var p = allData[i].feature.properties;

        html += stamp({
          application_number : p.application_number,
          date : p.allocations[0].date,
          allocation : p.allocations[0].allocation,
          demand : p.allocations[0].demand,
          ratio : p.allocations[0].ratio !== null ? (p.allocations[0].ratio*100).toFixed(2) : '100',
          water_right_type : p['Right Type'],
          priority_date : p.priority_date ? p.priority_date : 'Unknown'
        });
      }
    }


    $('#info-result').html(html);
    $('#info').animate({
      scrollTop: $('.info-box').height()
    }, 300);
  });

  currentPoints = points;

  huc.render(points);
};

},{"../markers/config":"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/markers/config.js"}],"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/map/index.js":[function(require,module,exports){
var map;
var baseMaps = {};
var overlayMaps = {};

var geojson = require('./geojson');
module.exports.legend = require('../legend');
module.exports.geojson = require('./geojson');

module.exports.init = function() {
  map = L.map('map',{trackResize:true});

  // add an OpenStreetMap tile layer
  L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  var wms1 = L.tileLayer.wms("https://mapsengine.google.com/15542600734275549444-11853667273131550346-4/wms/?version=1.3.0", {
      layers: '15542600734275549444-08112974690991164587-4',
      format: 'image/png',
      transparent: true,
      attribution: "",
      bounds : L.latLngBounds(
        L.latLng(42.00943198804058, -114.1307597213407),
        L.latLng(32.53426345367493, -124.40971171678298)
      )
  }).addTo(map);

  var wms2 = L.tileLayer.wms("https://mapsengine.google.com/15542600734275549444-11853667273131550346-4/wms/?version=1.3.0", {
      layers: '15542600734275549444-16143158689603361093-4',
      format: 'image/png',
      transparent: true,
      attribution: "",
      bounds : L.latLngBounds(
        L.latLng(42.00943198804058, -114.1307597213407),
        L.latLng(32.53426345367493, -124.40971171678298)
      )
  });

  baseMaps = {};
  overlayMaps = {
    'Watersheds': wms1,
    'HUC 12': wms2
  };

  L.control.layers(baseMaps, overlayMaps, {position: 'bottomleft'}).addTo(map);
};

module.exports.setHuc = function(huc) {
  geojson.init({
    huc : huc,
    map : map
  });
};

module.exports.getLeaflet = function() {
  return map;
};

},{"../legend":"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/legend/index.js","./geojson":"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/map/geojson.js"}],"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/markers/config.js":[function(require,module,exports){
var markers = {
  riparian : {
    allocated : {
      fillColor   : "#2525C9",
      color       : "#333333",
      weight      : 1,
      opacity     : 1,
      fillOpacity : 0.3,
			sides : 3,
			rotate : 90,
      width: 20,
      height: 20
    },
    unallocated : {
      fillColor   : "#ffffff",
      color       : "#333333",
      weight      : 1,
      opacity     : 1,
      fillOpacity : 0.3,
			sides : 3,
			rotate : 90,
      width: 20,
      height: 20
    }
  },
  application : {
    allocated : {
      fillColor   : "#2525C9",
      color       : "#333333",
      weight      : 1,
      opacity     : 1,
      fillOpacity : 0.3,
      sides       : 4,
      rotate      : 45,
      width: 20,
      height: 20
    },
    unallocated : {
      fillColor   : "#ffffff",
      color       : "#333333",
      weight      : 1,
      opacity     : 1,
      fillOpacity : 0.3,
      sides       : 4,
      rotate      : 45,
      width: 20,
      height: 20
    }
  },
  noDemand : {
    noFill : true,
    //sides : 0,
    color : "#333333",
    strikethrough : true,
    radius : 5,
    height : 12,
    width : 12
  }
};
module.exports.defaults = markers;

module.exports.percentDemand = function(options, percent, noDemand) {
  if( noDemand ) {
     $.extend(true, options, markers.noDemand);
     return;
  }

  if( renderDemand == 'filled' ) {

    if( percent <= 0 ) {
      options.fillColor = '#333';
      options.fillOpacity = 0.3;
    } else {
      var o = percent;
      if( o > 1 ) o = 1;
      options.fillOpacity = o;
      options.fillColor = '#0000ff';
    }

  } else {

    if( percent >= 1 ) {
      options.fillColor = '#333';
      options.fillOpacity = .3;
    } else {
      var o = 1 - percent;
      if( o > 1 ) o = 1;
      if( o < 0 ) o = 0;

      options.fillOpacity = o;
      options.fillColor = '#ff0000';
    }

  }
  //options.fillColor = '#'+getColor(allocation / demand);
};

module.exports.percentDemandHuc = function(percent) {
  if( percent == -1 ) {
     return {
       fillColor : '#ffffff',
       fillOpacity : .2,
       weight : 1,
       color: '#333333'
     }
  }


  if( renderDemand == 'filled' ) {

    if( percent <= 0 ) {

      return {
        fillColor : '#333333',
        fillOpacity : 0.3,
        weight : 2,
        color: '#333333'
      };


    } else {
      var o = percent;
      if( o > 0.8 ) o = 0.8;

      return {
        fillColor : '#0000ff',
        fillOpacity : o,
        weight : 2,
        color: '#333333'
      };
    }

  } else {

    if( percent >= 1 ) {

      return {
        fillColor : '#333333',
        fillOpacity : 0.3,
        weight : 2,
        color: '#333333'
      }

    } else {
      var o = 1 - percent;
      if( o > 0.8 ) o = 0.8;
      if( o < 0 ) o = 0;

      return {
        fillColor : '#ff0000',
        fillOpacity : o,
        weight : 2,
        color: '#333333'
      };

    }

  }
  //options.fillColor = '#'+getColor(allocation / demand);
};

},{}],"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/markers/droughtIcon.js":[function(require,module,exports){
var IconRenderer = require('./iconRenderer');

module.exports = function(config) {
  this.config = config;
  this.ele = document.createElement('canvas');

  this.redraw = function() {
    var w = config.height || 32;
    var h = config.width || 32;

    this.ele.height = h;
    this.ele.width = w;

    var ctx = this.ele.getContext("2d");
    ctx.clearRect(0, 0, w, h);

    IconRenderer(ctx, config);
  };

  this.redraw();
};

},{"./iconRenderer":"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/markers/iconRenderer.js"}],"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/markers/iconRenderer.js":[function(require,module,exports){
var util = require('./utils');

module.exports = function(ctx, config) {

  var sides = config.sides !== null ? config.sides : 6;
  var rotate = config.rotate ? config.rotate : 0;
  var x = config.width / 2;
  var y = config.height / 2;

  var a = ((Math.PI * 2) / config.sides);
  var r = rotate * (Math.PI / 180);

  var radius = (config.width / 2) - 1;

  var fillStyle = util.hexToRgb(config.fillColor);
  fillStyle.push(config.fillOpacity);
  ctx.fillStyle = 'rgba('+fillStyle.join(',')+')';

  ctx.strokeStyle = config.color;

  // think you need to adjust by x, y
  ctx.beginPath();

  // draw circle
  if ( sides < 3 ) {

    ctx.arc(x, y, radius, 0, 2*Math.PI);

  } else {

    var tx, ty, i;
    for (i = 0; i < config.sides; i++) {
      tx = x + (radius * Math.cos(a*i-r));
      ty = y + (radius * Math.sin(a*i-r));

      if( i === 0 ) ctx.moveTo(tx, ty);
      else ctx.lineTo(tx, ty);
    }
    ctx.lineTo(x + (radius * Math.cos(-1 * r)), y + (radius * Math.sin(-1 * r)));
  }

  if( !config.noFill ) ctx.fill();
  ctx.stroke();

  if( config.strikethrough ) {
    ctx.beginPath();
    ctx.moveTo(1,1);
    ctx.lineTo((x*2) - 1, (y*2) - 1);
    ctx.stroke();
  }
}

},{"./utils":"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/markers/utils.js"}],"/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/markers/utils.js":[function(require,module,exports){
module.exports.hexToRgb = function(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
    ] : [0,0,0];
};

module.exports.getColor = function(num) {
  if( num > 1 ) num = 1;
  if( num < 0 ) num = 0;

  var spread = Math.floor(510*num) - 255;

  if( spread < 0 ) return "ff00"+toHex(255+spread);
  else if( spread > 0 ) return toHex(255-spread)+"00ff";
  else return "ffff00";
};

module.exports.toHex = function(num) {
  num = num.toString(16);
  if( num.length == 1 ) num = "0"+num;
  return num;
};

},{}]},{},["/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/index.js"])("/Users/jrmerz/dev/watershed/dwrat-app/lib/shared/index.js")
});
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJsaWIvc2hhcmVkL2ZpbGUvaW5kZXguanMiLCJsaWIvc2hhcmVkL2ZpbGUvcHJvY2Vzcy5qcyIsImxpYi9zaGFyZWQvZmlsZS9zZXR1cC5qcyIsImxpYi9zaGFyZWQvaHVjL2luZGV4LmpzIiwibGliL3NoYXJlZC9pbmRleC5qcyIsImxpYi9zaGFyZWQvbGVnZW5kL2luZGV4LmpzIiwibGliL3NoYXJlZC9tYXAvZ2VvanNvbi5qcyIsImxpYi9zaGFyZWQvbWFwL2luZGV4LmpzIiwibGliL3NoYXJlZC9tYXJrZXJzL2NvbmZpZy5qcyIsImxpYi9zaGFyZWQvbWFya2Vycy9kcm91Z2h0SWNvbi5qcyIsImxpYi9zaGFyZWQvbWFya2Vycy9pY29uUmVuZGVyZXIuanMiLCJsaWIvc2hhcmVkL21hcmtlcnMvdXRpbHMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDclZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25EQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25EQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsInZhciBzZXR1cCA9IHJlcXVpcmUoJy4vc2V0dXAnKTtcbnZhciBwcm9jZXNzID0gcmVxdWlyZSgnLi9wcm9jZXNzJyk7XG5cbnZhciBIRUFERVJTID0ge1xuICAgIGFwcGxpY2F0aW9uX251bWJlciA6IHtcbiAgICAgICAgcmVxdWlyZWQgOiB0cnVlLFxuICAgICAgICB0eXBlIDogJ3N0cmluZydcbiAgICB9LFxuICAgIGRlbWFuZF9kYXRlIDoge1xuICAgICAgICByZXF1aXJlZCA6IHRydWUsXG4gICAgICAgIHR5cGUgOiAnZGF0ZS1zdHJpbmcnXG4gICAgfSxcbiAgICB3YXRlcnNoZWQgOiB7XG4gICAgICAgIHJlcXVpcmVkIDogZmFsc2UsXG4gICAgICAgIHR5cGUgOiAnc3RyaW5nJ1xuICAgIH0sXG4gICAgc2Vhc29uIDoge1xuICAgICAgICByZXF1aXJlZCA6IGZhbHNlLFxuICAgICAgICB0eXBlIDogJ2Jvb2xlYW4nLFxuICAgIH0sXG4gICAgJ0hVQy0xMicgOiB7XG4gICAgICAgIHJlcXVpcmVkIDogZmFsc2UsXG4gICAgICAgIHR5cGUgOiAnYm9vbGVhbidcbiAgICB9LFxuICAgIHdhdGVyX3JpZ2h0X3R5cGUgOiB7XG4gICAgICAgIHJlcXVpcmVkIDogZmFsc2UsXG4gICAgICAgIHR5cGUgOiAnc3RyaW5nJ1xuICAgIH0sXG4gICAgcHJpb3JpdHlfZGF0ZSA6IHtcbiAgICAgICAgcmVxdWlyZWQgOiB0cnVlLFxuICAgICAgICB0eXBlIDogJ2RhdGUtc3RyaW5nJ1xuICAgIH0sXG4gICAgcmlwYXJpYW4gOiB7XG4gICAgICAgIHJlcXVpcmVkIDogZmFsc2UsXG4gICAgICAgIHR5cGUgOiAnYm9vbGVhbidcbiAgICB9LFxuICAgIHByZTE5MTQgOiB7XG4gICAgICAgIHJlcXVpcmVkIDogZmFsc2UsXG4gICAgICAgIHR5cGUgOiAnYm9vbGVhbidcbiAgICB9LFxuICAgIGRlbWFuZCA6IHtcbiAgICAgICAgcmVxdWlyZWQgOiB0cnVlLFxuICAgICAgICB0eXBlIDogJ2Zsb2F0J1xuICAgIH0sXG4gICAgYWxsb2NhdGlvbiA6IHtcbiAgICAgICAgcmVxdWlyZWQgOiB0cnVlLFxuICAgICAgICB0eXBlIDogJ2Zsb2F0J1xuICAgIH1cbn07XG5cbnZhciBwcmV2aW91c0F0dHJNYXAgPSB7fTtcbnZhciBsb2NhdGlvbnMgPSB7fTtcblxuZnVuY3Rpb24gcmVhZChyYXcsIGNhbGxiYWNrKSB7XG4gICAgX3Jlc2V0VUkoKTtcblxuICAgIHZhciB0eXBlID0gJ3RleHQnO1xuXG4gICAgdmFyIHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XG4gICAgcmVhZGVyLm9ubG9hZCA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgcGFyc2UodHlwZSwgZS50YXJnZXQucmVzdWx0LCBjYWxsYmFjayk7XG4gICAgfTtcblxuICAgIGlmKCByYXcubmFtZS5tYXRjaCgvLipcXC54bHN4PyQvKSApIHtcbiAgICAgICAgdHlwZSA9IHJhdy5uYW1lLnJlcGxhY2UoLy4qXFwuLywnJyk7XG4gICAgICAgIHJlYWRlci5yZWFkQXNCaW5hcnlTdHJpbmcocmF3KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZWFkZXIucmVhZEFzVGV4dChyYXcpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gX3Jlc2V0VUkoKSB7XG4gICAgJCgnI21hdGNoVGFibGUnKS5odG1sKCcnKTtcbiAgICAkKCcjZmlsZS1sb2NhdGUnKS5odG1sKCcnKTtcblxufVxuXG5mdW5jdGlvbiBtYXRjaENvbHMoZGF0YSwgY2FsbGJhY2spIHtcbiAgICBpZiggZGF0YS5sZW5ndGggPT0gMCApIHJldHVybiBhbGVydCgnWW91ciBmaWxlIGlzIGVtcHR5Jyk7XG5cbiAgICB2YXIgbWF0Y2hlcyA9IFtdO1xuICAgIHZhciByZXF1aXJlZE1pc21hdGNoZXMgPSBbXTtcbiAgICB2YXIgbWFwcGVkID0gcHJldmlvdXNBdHRyTWFwO1xuXG4gICAgZm9yKCB2YXIga2V5IGluIEhFQURFUlMgKSB7XG4gICAgICAgIGlmKCBwcmV2aW91c0F0dHJNYXBba2V5XSApIHtcbiAgICAgICAgICAgIG1hdGNoZXMucHVzaChrZXkpO1xuICAgICAgICB9IGVsc2UgaWYoIGRhdGFbMF0uaW5kZXhPZihrZXkpID09IC0xICYmIEhFQURFUlNba2V5XS5yZXF1aXJlZCApIHtcbiAgICAgICAgICAgIHJlcXVpcmVkTWlzbWF0Y2hlcy5wdXNoKGtleSk7XG4gICAgICAgIH0gZWxzZSBpZiggZGF0YVswXS5pbmRleE9mKGtleSkgPiAtMSApIHtcbiAgICAgICAgICAgIG1hdGNoZXMucHVzaChrZXkpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYoIHJlcXVpcmVkTWlzbWF0Y2hlcy5sZW5ndGggPT0gMCApIHJldHVybiBjYWxsYmFjayhwcmV2aW91c0F0dHJNYXApO1xuXG4gICAgdmFyIHRhYmxlID0gJzx0YWJsZSBjbGFzcz1cInRhYmxlXCI+JztcbiAgICBmb3IoIHZhciBpID0gMDsgaSA8IHJlcXVpcmVkTWlzbWF0Y2hlcy5sZW5ndGg7IGkrKyApIHtcbiAgICAgICAgdGFibGUgKz0gJzx0cj48dGQ+JytyZXF1aXJlZE1pc21hdGNoZXNbaV0rJzwvdGQ+PHRkPicrX2NyZWF0ZU1hdGNoU2VsZWN0b3IocmVxdWlyZWRNaXNtYXRjaGVzW2ldLCBkYXRhWzBdLCBtYXRjaGVzKSsnPC90ZD48L3RyPic7XG4gICAgfVxuICAgIHRhYmxlICs9ICc8L3RhYmxlPic7XG5cbiAgICAkKCcjbWF0Y2hUYWJsZScpLmh0bWwoJzxkaXYgc3R5bGU9XCJtYXJnaW4tdG9wOjIwcHg7Zm9udC13ZWlnaHQ6Ym9sZFwiPlBsZWFzZSBtYXRjaCB0aGUgZm9sbG93aW5nIHJlcXVpcmVkIGNvbHVtbnMgdG8gY29udGludWU8L2Rpdj4nK3RhYmxlKTtcbiAgICAkKCcubWF0Y2gtc2VsZWN0b3InKS5vbignY2hhbmdlJywgZnVuY3Rpb24oKXtcbiAgICAgICAgdmFyIGtleSA9ICQodGhpcykuYXR0cigna2V5Jyk7XG4gICAgICAgIHZhciB2YWwgPSAkKHRoaXMpLnZhbCgpO1xuXG4gICAgICAgIGlmKCB2YWwgPT0gJycgfHwgIXZhbCApIHtcbiAgICAgICAgICAgIGRlbGV0ZSBtYXBwZWRba2V5XTtcbiAgICAgICAgICAgIHJlcXVpcmVkTWlzbWF0Y2hlcy5wdXNoKGtleSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBtYXBwZWRba2V5XSA9IHZhbDtcbiAgICAgICAgICAgIHZhciBpbmRleCA9IHJlcXVpcmVkTWlzbWF0Y2hlcy5pbmRleE9mKGtleSk7XG4gICAgICAgICAgICBpZiAoaW5kZXggPiAtMSkgcmVxdWlyZWRNaXNtYXRjaGVzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgIH1cblxuXG4gICAgICAgIGlmKCByZXF1aXJlZE1pc21hdGNoZXMubGVuZ3RoID09IDAgKSB7XG4gICAgICAgICAgICAkKCcjbWF0Y2hUYWJsZScpLmh0bWwoJycpO1xuICAgICAgICAgICAgcHJldmlvdXNBdHRyTWFwID0gbWFwcGVkO1xuICAgICAgICAgICAgY2FsbGJhY2sobWFwcGVkKTtcbiAgICAgICAgfVxuICAgIH0pO1xufVxuXG5mdW5jdGlvbiBfY3JlYXRlTWF0Y2hTZWxlY3RvcihrZXksIGFyciwgbWF0Y2hlcykge1xuICAgIHZhciBzZWxlY3QgPSAnPHNlbGVjdCBjbGFzcz1cIm1hdGNoLXNlbGVjdG9yXCIga2V5PVwiJytrZXkrJ1wiPjxvcHRpb24+PC9vcHRpb24+JztcblxuICAgIGZvciggdmFyIGkgPSAwOyBpIDwgYXJyLmxlbmd0aDsgaSsrICkge1xuICAgICAgICBpZiggbWF0Y2hlcy5pbmRleE9mKGFycltpXSkgPiAtMSApIGNvbnRpbnVlO1xuICAgICAgICBzZWxlY3QgKz0gJzxvcHRpb24gdmFsdWU9XCInK2FycltpXSsnXCI+JythcnJbaV0rJzwvb3B0aW9uPic7XG4gICAgfVxuICAgIHJldHVybiBzZWxlY3QgKyAnPC9zZWxlY3Q+Jztcbn1cblxuZnVuY3Rpb24gZ2V0QXR0ckNvbChhdHRyLCBkYXRhLCBtYXApIHtcbiAgICBpZiggbWFwW2F0dHJdICkgcmV0dXJuIGRhdGFbMF0uaW5kZXhPZihtYXBbYXR0cl0pO1xuICAgIHJldHVybiBkYXRhWzBdLmluZGV4T2YoYXR0cik7XG59XG5cbmZ1bmN0aW9uIHNlbGVjdFdvcmtzaGVldChzaGVldE5hbWVzLCBjYWxsYmFjaykge1xuICAgIGNvbnNvbGUubG9nKHNoZWV0TmFtZXMpO1xuXG4gICAgaWYoIHNoZWV0TmFtZXMubGVuZ3RoID09IDEgKSBjYWxsYmFjayhzaGVldE5hbWVzWzBdKTtcblxuICAgIC8vIGFkZCBVSSBpbnRlcmFjdGlvbiBoZXJlXG4gICAgY2FsbGJhY2soc2hlZXROYW1lc1swXSk7XG59XG5cbmZ1bmN0aW9uIHBhcnNlKHR5cGUsIGNvbnRlbnRzLCBjYWxsYmFjaykge1xuICAgIGlmKCB0eXBlID09ICd4bHN4JyApIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGZ1bmN0aW9uIG9uWGxzeENvbXBsZXRlKHdiKXtcbiAgICAgICAgICAgICAgICBzZWxlY3RXb3Jrc2hlZXQod2IuU2hlZXROYW1lcywgZnVuY3Rpb24oc2hlZXROYW1lKXtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGNzdiA9IFhMU1gudXRpbHMuc2hlZXRfdG9fY3N2KHdiLlNoZWV0c1tzaGVldE5hbWVdKTtcbiAgICAgICAgICAgICAgICAgICAgJC5jc3YudG9BcnJheXMoY3N2LCB7fSwgZnVuY3Rpb24oZXJyLCBkYXRhKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKCBlcnIgKSByZXR1cm4gY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIGRhdGEpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIHdvcmtlciA9IG5ldyBXb3JrZXIoJ2Jvd2VyX2NvbXBvbmVudHMvanMteGxzeC94bHN4d29ya2VyLmpzJyk7XG4gICAgICAgICAgICB3b3JrZXIub25tZXNzYWdlID0gZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgICAgIHN3aXRjaChlLmRhdGEudCkge1xuICAgICAgICAgICAgICAgICAgICBjYXNlICdyZWFkeSc6IGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlICdlJzogY29uc29sZS5lcnJvcihlLmRhdGEuZCk7IGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlICd4bHN4Jzogb25YbHN4Q29tcGxldGUoSlNPTi5wYXJzZShlLmRhdGEuZCkpOyBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgd29ya2VyLnBvc3RNZXNzYWdlKHtkOmNvbnRlbnRzLGI6dHJ1ZX0pO1xuXG4gICAgICAgIH0gY2F0Y2goZSkge1xuICAgICAgICAgICAgY2FsbGJhY2soZSk7XG4gICAgICAgIH1cblxuICAgIH0gZWxzZSBpZiggaW5mby5leHQgPT0gJ3hscycgKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBmdW5jdGlvbiBvblhsc0NvbXBsZXRlKHdiKXtcbiAgICAgICAgICAgICAgICBzZWxlY3RXb3Jrc2hlZXQod2IuU2hlZXROYW1lcywgZnVuY3Rpb24oc2hlZXROYW1lKXtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGNzdiA9IFhMUy51dGlscy5zaGVldF90b19jc3Yod2IuU2hlZXRzW3NoZWV0TmFtZV0pO1xuICAgICAgICAgICAgICAgICAgICAkLmNzdi50b0FycmF5cyhjc3YsIHt9LCBmdW5jdGlvbihlcnIsIGRhdGEpe1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYoIGVyciApIHJldHVybiBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgd29ya2VyID0gbmV3IFdvcmtlcignYm93ZXJfY29tcG9uZW50cy9qcy14bHMveGxzd29ya2VyLmpzJyk7XG4gICAgICAgICAgICB3b3JrZXIub25tZXNzYWdlID0gZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgICAgIHN3aXRjaChlLmRhdGEudCkge1xuICAgICAgICAgICAgICAgICAgICBjYXNlICdyZWFkeSc6IGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlICdlJzogY29uc29sZS5lcnJvcihlLmRhdGEuZCk7IGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlICd4bHN4Jzogb25YbHNDb21wbGV0ZShKU09OLnBhcnNlKGUuZGF0YS5kKSk7IGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB3b3JrZXIucG9zdE1lc3NhZ2Uoe2Q6Y29udGVudHMsYjp0cnVlfSk7XG5cbiAgICAgICAgfSBjYXRjaChlKSB7XG4gICAgICAgICAgICBkZWJ1Z2dlcjtcbiAgICAgICAgICAgIHRoaXMub25Db21wbGV0ZShlLCBudWxsLCBpbmZvLCAxLCAxLCBhcnIsIGNhbGxiYWNrKTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICB2YXIgb3B0aW9ucyA9IHt9O1xuICAgICAgICAgICAgLy9pZiggaW5mby5wYXJzZXIgPT0gJ2Nzdi10YWInICkgb3B0aW9ucy5zZXBhcmF0b3IgPSAnXFx0JztcblxuICAgICAgICAgICAgJC5jc3YudG9BcnJheXMoY29udGVudHMsIG9wdGlvbnMsIGZ1bmN0aW9uKGVyciwgZGF0YSl7XG4gICAgICAgICAgICAgICAgaWYoIGVyciApIHJldHVybiBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIGRhdGEpO1xuICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgfSBjYXRjaChlKSB7XG4gICAgICAgICAgICBkZWJ1Z2dlcjtcbiAgICAgICAgICAgIHRoaXMub25Db21wbGV0ZShlLCBudWxsLCBpbmZvLCAxLCAxLCBhcnIsIGNhbGxiYWNrKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZnVuY3Rpb24gY3JlYXRlR2VvSnNvbihkYXRhLCBhdHRyTWFwLCBjYWxsYmFjaykge1xuICAgIC8vIGZpcnN0IGxvY2F0ZSBkYXRhXG4gICAgJCgnI2ZpbGUtbG9jYXRlJykuaHRtbCgnTG9jYXRpbmcgZGF0YS4uLicpO1xuXG4gICAgdmFyIGlkcyA9IFtdO1xuICAgIHZhciBjb2wgPSBnZXRBdHRyQ29sKCdhcHBsaWNhdGlvbl9udW1iZXInLCBkYXRhLCBhdHRyTWFwKTtcbiAgICBmb3IoIHZhciBpID0gMTsgaSA8IGRhdGEubGVuZ3RoOyBpKysgKSB7XG4gICAgICAgIHZhciBpZCA9IGRhdGFbaV1bY29sXTtcbiAgICAgICAgaWYoICFsb2NhdGlvbnNbaWRdICkgaWRzLnB1c2goZGF0YVtpXVtjb2xdKTtcbiAgICB9XG5cbiAgICBfbG9jYXRlRGF0YSgwLCBpZHMsIGZ1bmN0aW9uKCl7XG5cbiAgICAgICAgJCgnI2ZpbGUtbG9jYXRlJykuaHRtbCgnQ3JlYXRpbmcgZGF0YS4uLicpO1xuXG4gICAgICAgIHZhciBpTWFwID0ge307XG4gICAgICAgIGZvciggdmFyIGtleSBpbiBhdHRyTWFwICkgaU1hcFthdHRyTWFwW2tleV1dID0ga2V5O1xuXG4gICAgICAgIHZhciBnZW9Kc29uID0gW107XG4gICAgICAgIGZvciggdmFyIGkgPSAxOyBpIDwgZGF0YS5sZW5ndGg7IGkrKyApIHtcbiAgICAgICAgICAgIGlmKCAhbG9jYXRpb25zW2RhdGFbaV1bY29sXV0gKSBjb250aW51ZTtcblxuICAgICAgICAgICAgdmFyIHAgPSB7XG4gICAgICAgICAgICAgICAgdHlwZSA6ICdGZWF0dXJlJyxcbiAgICAgICAgICAgICAgICBnZW9tZXRyeSA6ICQuZXh0ZW5kKHt9LCB0cnVlLCBsb2NhdGlvbnNbZGF0YVtpXVtjb2xdXSksXG4gICAgICAgICAgICAgICAgcHJvcGVydGllcyA6IHt9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZvciggdmFyIGogPSAwOyBqIDwgZGF0YVswXS5sZW5ndGg7IGorKyApIHtcbiAgICAgICAgICAgICAgICB2YXIga2V5ID0gZGF0YVswXVtqXTtcbiAgICAgICAgICAgICAgICBpZiggaU1hcFtrZXldICkga2V5ID0gaU1hcFtrZXldO1xuICAgICAgICAgICAgICAgIHAucHJvcGVydGllc1trZXldID0gKEhFQURFUlNba2V5XSAmJiBIRUFERVJTW2tleV0udHlwZSA9PSAnZmxvYXQnKSA/IHBhcnNlRmxvYXQoZGF0YVtpXVtqXSkgOiBkYXRhW2ldW2pdO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBwLnByb3BlcnRpZXMuYWxsb2NhdGlvbnMgPSBbe1xuICAgICAgICAgICAgICAgIHNlYXNvbiA6IHRydWUsXG4gICAgICAgICAgICAgICAgYWxsb2NhdGlvbiA6IHAucHJvcGVydGllcy5hbGxvY2F0aW9uLFxuICAgICAgICAgICAgICAgIGRlbWFuZCA6IHAucHJvcGVydGllcy5kZW1hbmQsXG4gICAgICAgICAgICAgICAgZm9yZWNhc3QgOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBkYXRlIDogcC5wcm9wZXJ0aWVzLmRlbWFuZF9kYXRlLFxuICAgICAgICAgICAgICAgIHB1YmxpY19oZWFsdGhfYmluZCA6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHdyYmluZCA6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHJhdGlvIDogKHAucHJvcGVydGllcy5kZW1hbmQgPiAwKSA/IChwLnByb3BlcnRpZXMuYWxsb2NhdGlvbiAvIHAucHJvcGVydGllcy5kZW1hbmQpIDogMFxuICAgICAgICAgICAgfV07XG5cbiAgICAgICAgICAgIGdlb0pzb24ucHVzaChwKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKCBnZW9Kc29uTGF5ZXIgKSBtYXAucmVtb3ZlTGF5ZXIoZ2VvSnNvbkxheWVyKTtcbiAgICAgICAgYWxsRGF0YSA9IFtdO1xuICAgICAgICBsYXN0UmVzcFBvaW50cyA9IGdlb0pzb247XG4gICAgICAgIGFkZEdlb0pzb24oZ2VvSnNvbik7XG4gICAgICAgICQoJyNmaWxlLWxvY2F0ZScpLmh0bWwoJycpO1xuICAgICAgICBjYWxsYmFjaygpO1xuICAgIH0pO1xufVxuXG5mdW5jdGlvbiBfbG9jYXRlRGF0YShpbmRleCwgaWRzLCBjYWxsYmFjaykge1xuICAgIGlmKCBpbmRleCsxID49IGlkcy5sZW5ndGggKSB7XG4gICAgICAgIGNhbGxiYWNrKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIGlkR3JvdXAgPSBbXTtcblxuICAgICAgICB2YXIgaSA9IDA7XG4gICAgICAgIGZvciggaSA9IGluZGV4OyBpIDwgaW5kZXgrMjAwOyBpKysgKSB7XG4gICAgICAgICAgICBpZiggaWRzLmxlbmd0aCA9PSBpICkgYnJlYWs7XG4gICAgICAgICAgICBpZEdyb3VwLnB1c2goaWRzW2ldKTtcbiAgICAgICAgfVxuICAgICAgICBpbmRleCArPSAyMDA7XG4gICAgICAgIGNvbnNvbGUubG9nKGluZGV4KTtcblxuXG5cbiAgICAgICAgdmFyIHF1ZXJ5ID0gbmV3IGdvb2dsZS52aXN1YWxpemF0aW9uLlF1ZXJ5KCdodHRwOi8vd2F0ZXJzaGVkLmljZS51Y2RhdmlzLmVkdS92aXpzb3VyY2UvcmVzdD92aWV3PWxvY2F0ZShcXCcnK1xuICAgICAgICAgICAgaWRHcm91cC5qb2luKCcsJykrJ1xcJykmdHE9U0VMRUNUIConKTtcbiAgICAgICAgcXVlcnkuc2VuZChmdW5jdGlvbihyZXNwKXtcbiAgICAgICAgICAgIGlmKCByZXNwLmlzRXJyb3IoKSApIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhyZXNwLmdldE1lc3NhZ2UoKSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHZhciBkdCA9IHJlc3AuZ2V0RGF0YVRhYmxlKCk7XG4gICAgICAgICAgICAgICAgZm9yKCB2YXIgaSA9IDA7IGkgPCBkdC5nZXROdW1iZXJPZlJvd3MoKTsgaSsrICkge1xuICAgICAgICAgICAgICAgICAgICBsb2NhdGlvbnNbZHQuZ2V0VmFsdWUoaSwgMCldID0gSlNPTi5wYXJzZShkdC5nZXRWYWx1ZShpLCAyKSk7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgJCgnI2ZpbGUtbG9jYXRlJykuaHRtbCgnTG9jYXRpbmcgZGF0YSAnKygoaW5kZXgvaWRzLmxlbmd0aCkudG9GaXhlZCgyKSoxMDApKyclLi4uJyk7XG4gICAgICAgICAgICBfbG9jYXRlRGF0YShpbmRleCwgaWRzLCBjYWxsYmFjayk7XG4gICAgICAgIH0pO1xuICAgIH1cbn1cblxuLy8gVE9ET1xuZnVuY3Rpb24gX3Bvc3RRdWVyeSh2aWV3LCBxdWVyeSwgY2FsbGJhY2spIHtcbiAgICAkLmFqYXgoe1xuICAgICAgICB0eXBlIDogJ1BPU1QnLFxuICAgICAgICB1cmwgOiAnaHR0cDovL3dhdGVyc2hlZC5pY2UudWNkYXZpcy5lZHUvdml6c291cmNlL3Jlc3QnLFxuICAgICAgICBkYXRhIDoge1xuICAgICAgICAgICAgdmlldyA6IHZpZXcsXG4gICAgICAgICAgICB0cSA6IHF1ZXJ5LFxuICAgICAgICAgICAgdHF4OiAncmVxSWQ6MSdcbiAgICAgICAgfSxcbiAgICAgICAgZGF0YVR5cGUgOiAndGV4dCcsXG4gICAgICAgIHN1Y2Nlc3MgOiBmdW5jdGlvbihib2R5KSB7XG4gICAgICAgICAgICAvLyBjbGVhbiBhbmQgZXZhbCAocmVtZW1iZXIgdGhpcyBpcyBub3QganNvbi4uLilcbiAgICAgICAgICAgIHZhciBvYmogPSBldmFsKCcoJysoYm9keS5yZXBsYWNlKC9nb29nbGUudmlzdWFsaXphdGlvbi5RdWVyeS5zZXRSZXNwb25zZVxcKC8sJycpLnJlcGxhY2UoL1xcKTskLywnJykpKycpJyk7XG4gICAgICAgICAgICBjYWxsYmFjayhudWxsLCBuZXcgZ29vZ2xlLnZpc3VhbGl6YXRpb24uUXVlcnlSZXNwb25zZShvYmopKTtcbiAgICAgICAgfSxcbiAgICAgICAgZXJyb3IgOiBmdW5jdGlvbihyZXNwLCBzdGF0dXMpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKHN0YXR1cyk7XG4gICAgICAgIH1cbiAgICB9KTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIHNldHVwIDogc2V0dXAsXG4gIHByb2Nlc3MgOiBmdW5jdGlvbihlKSB7XG4gICAgcHJvY2VzcyhlLCB0aGlzKTtcbiAgfSxcbiAgcmVhZCA6IHJlYWQsXG4gIG1hdGNoQ29scyA6IG1hdGNoQ29scyxcbiAgZ2V0QXR0ckNvbCA6IGdldEF0dHJDb2wsXG4gIGNyZWF0ZUdlb0pzb24gOiBjcmVhdGVHZW9Kc29uXG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihlLCBmaWxlKSB7XG4gIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gIGUucHJldmVudERlZmF1bHQoKTtcbiAgdmFyIGZpbGVzID0gZS5kYXRhVHJhbnNmZXIgPyBlLmRhdGFUcmFuc2Zlci5maWxlcyA6IGUudGFyZ2V0LmZpbGVzOyAvLyBGaWxlTGlzdCBvYmplY3QuXG5cbiAgaWYoIGZpbGVzLmxlbmd0aCA+IDAgKSB7XG4gICAgJCgnI2ZpbGUtbG9jYXRlJykuaHRtbCgnTG9hZGluZyBmaWxlLi4uJyk7XG4gICAgZmlsZS5yZWFkKGZpbGVzWzBdLCBmdW5jdGlvbihlcnIsIGRhdGEpe1xuICAgICAgJCgnI2ZpbGUtbG9jYXRlJykuaHRtbCgnJyk7XG4gICAgICBmaWxlLm1hdGNoQ29scyhkYXRhLCBmdW5jdGlvbihjb2xNYXApe1xuICAgICAgICAvLyBub3cgbG9jYXRlIGRhdGEgYW5kIGNyZWF0ZVxuICAgICAgICBmaWxlLmNyZWF0ZUdlb0pzb24oZGF0YSwgY29sTWFwLCBmdW5jdGlvbigpe1xuXG4gICAgICAgICAgJCgnI2RhdGUtc2VsZWN0aW9uJykuaGlkZSgpO1xuICAgICAgICAgICQoJyNmaWxlLXNlbGVjdGlvbicpLmh0bWwoZmlsZXNbMF0ubmFtZSsnIDxhIGNsYXNzPVwiYnRuIGJ0bi1kZWZhdWx0XCIgaWQ9XCJyZW1vdmUtZmlsZS1idG5cIj48aSBjbGFzcz1cImZhIGZhLXRpbWVzXCI+PC9pPjwvYT4nKTtcbiAgICAgICAgICAkKCcjcmVtb3ZlLWZpbGUtYnRuJykub24oJ2NsaWNrJyxmdW5jdGlvbigpe1xuICAgICAgICAgICAgaWYoIGdlb0pzb25MYXllciApIG1hcC5yZW1vdmVMYXllcihnZW9Kc29uTGF5ZXIpO1xuICAgICAgICAgICAgJCgnI2RhdGUtc2VsZWN0aW9uJykuc2hvdygpO1xuICAgICAgICAgICAgJCgnI2ZpbGUtc2VsZWN0aW9uJykuaHRtbCgnJyk7XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICAkKCcjZmlsZS1pbnB1dCcpLnZhbCgnJyk7XG4gICAgICAgICAgJCgnI2ZpbGUtbW9kYWwnKS5tb2RhbCgnaGlkZScpO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigpIHtcbiAgJCgnI2Nsb3NlLXBvcHVwJykub24oJ2NsaWNrJywgZnVuY3Rpb24oKXtcbiAgICAkKCcjaW5mbycpLnJlbW92ZUNsYXNzKCdmYWRlSW5Eb3duJykuYWRkQ2xhc3MoJ3NsaWRlT3V0UmlnaHQnKTtcblxuICAgIHNlbGVjdChudWxsKTtcbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XG4gICAgICAkKCcjaW5mbycpLmhpZGUoKS5hZGRDbGFzcygnZmFkZUluRG93bicpLnJlbW92ZUNsYXNzKCdzbGlkZU91dFJpZ2h0Jyk7XG4gICAgfSwgODAwKTtcbiAgfSk7XG5cbiAgLy8gZmlsZSB1cGxvYWQgc3R1ZmZcbiAgJCgnI2ZpbGUtbW9kYWwnKS5tb2RhbCh7c2hvdzpmYWxzZX0pO1xuICAkKCcjZmlsZS1pbnB1dCcpLm9uKCdjaGFuZ2UnLCBmdW5jdGlvbihlKSB7XG4gICAgcHJvY2Vzc0ZpbGUoZSk7XG4gIH0pO1xuICAkKCcjdXBsb2FkLWJ0bicpLm9uKCdjbGljaycsIGZ1bmN0aW9uKCl7XG4gICAgJCgnI2ZpbGUtbW9kYWwnKS5tb2RhbCgnc2hvdycpO1xuICB9KTtcblxuICAkKCdib2R5Jykub24oJ2RyYWdvdmVyJywgZnVuY3Rpb24oZSl7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuXG4gICAgJCgnI3VwbG9hZC1kcm9wLW1lc3NhZ2UnKS5zaG93KCk7XG4gICAgJCgnI3dyYXBwZXInKS5jc3MoJ29wYWNpdHknLCAwLjMpO1xuICB9KS5vbignZHJhZ2xlYXZlJywgZnVuY3Rpb24oZSl7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuXG4gICAgJCgnI3VwbG9hZC1kcm9wLW1lc3NhZ2UnKS5oaWRlKCk7XG4gICAgJCgnI3dyYXBwZXInKS5jc3MoJ29wYWNpdHknLDEpO1xuICB9KS5vbignZHJvcCcsIGZ1bmN0aW9uKGUpe1xuICAgICQoJyN1cGxvYWQtZHJvcC1tZXNzYWdlJykuaGlkZSgpO1xuICAgICQoJyN3cmFwcGVyJykuY3NzKCdvcGFjaXR5JywxKTtcblxuICAgIHByb2Nlc3NGaWxlKGUub3JpZ2luYWxFdmVudCk7XG4gICAgJCgnI2ZpbGUtbW9kYWwnKS5tb2RhbCgnc2hvdycpO1xuXG4gIH0pO1xufTtcbiIsInZhciBtYXA7XG52YXIgbGF5ZXJzID0gW107XG52YXIgcG9pbnRzQnlIdWMgPSB7fTtcbnZhciB1cmxQcmVmaXggPSAnaHR0cDovL3dhdGVyc2hlZC5pY2UudWNkYXZpcy5lZHUvdml6c291cmNlL3Jlc3Q/dmlldz1nZXRfaHVjX2J5X2lkKFxcJyc7XG52YXIgdXJsUG9zdGl4ID0gJ1xcJykmdHE9U0VMRUNUIConO1xuXG52YXIgaHVjQ2FjaGUgPSB7fTtcbnZhciByZXF1ZXN0ZWQgPSB7fTtcblxudmFyIHNob3dpbmcgPSB0cnVlO1xudmFyIGN1cnJlbnRQb2ludHMgPSBudWxsO1xuXG5mdW5jdGlvbiBpbml0KG0pIHtcbiAgbWFwID0gbTtcblxuICAkKCcjcmVuZGVySHVjQXZnJykub24oJ2NoYW5nZScsIGZ1bmN0aW9uKCl7XG4gICAgc2hvd2luZyA9ICQodGhpcykuaXMoJzpjaGVja2VkJyk7XG4gICAgb25WaXNpYmlsaXR5VXBkYXRlKHNob3dpbmcpO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gb25WaXNpYmlsaXR5VXBkYXRlKCkge1xuICBpZiggIXNob3dpbmcgKSB7XG4gICAgY2xlYXIoKTtcbiAgfSBlbHNlIGlmKCBjdXJyZW50UG9pbnRzICE9PSBudWxsICl7XG4gICAgcmVuZGVyKGN1cnJlbnRQb2ludHMpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNsZWFyKCkge1xuICAvLyBjbGVhciBhbGwgbGF5ZXJzXG4gIGZvciggdmFyIGkgPSAwOyBpIDwgbGF5ZXJzLmxlbmd0aDsgaSsrICkge1xuICAgIG1hcC5yZW1vdmVMYXllcihsYXllcnNbaV0pO1xuICB9XG4gIGxheWVycyA9IFtdO1xuICBwb2ludHNCeUh1YyA9IHt9O1xufVxuXG5mdW5jdGlvbiByZW5kZXIocG9pbnRzKSB7XG4gIGN1cnJlbnRQb2ludHMgPSBwb2ludHM7XG4gIGlmKCAhc2hvd2luZyApIHJldHVybjtcblxuICBjbGVhcigpO1xuXG4gIC8vIG9yZ2FuaXplIHBvaW50cyBieSBodWNcbiAgdmFyIGh1YztcbiAgZm9yKCB2YXIgaSA9IDA7IGkgPCBjdXJyZW50UG9pbnRzLmxlbmd0aDsgaSsrICkge1xuICAgIC8vIFRPRE86IGRpZCBxdWlubiBjaGFuZ2UgdGhpcz9cbiAgICBodWMgPSBwb2ludHNbaV0ucHJvcGVydGllc1snSFVDLTEyJ10gfHwgcG9pbnRzW2ldLnByb3BlcnRpZXMuaHVjXzEyO1xuXG4gICAgaWYoIHBvaW50c0J5SHVjW2h1Y10gKSBwb2ludHNCeUh1Y1todWNdLnB1c2gocG9pbnRzW2ldKTtcbiAgICBlbHNlIHBvaW50c0J5SHVjW2h1Y10gPSBbcG9pbnRzW2ldXTtcbiAgfVxuXG4gIC8vIHJlcXVlc3QgbWlzc2luZyBodWMgZ2VvanNvbiBhbmQvb3IgcmVuZGVyIGh1Y1xuICBmb3IoIHZhciBodWMgaW4gcG9pbnRzQnlIdWMgKSB7XG4gICAgaWYoIGh1YyA9PT0gdW5kZWZpbmVkIHx8IGh1YyA9PT0gJ3VuZGVmaW5lZCcgKSBkZWJ1Z2dlcjtcblxuICAgIGlmKCBodWNDYWNoZVtodWNdICkgcmVuZGVySHVjKGh1Yyk7XG4gICAgZWxzZSBpZiggIXJlcXVlc3RlZFtodWNdICkgcmVxdWVzdChodWMpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHJlcXVlc3QoaHVjSWQpIHtcbiAgcmVxdWVzdGVkW2h1Y0lkXSA9IDE7XG5cbiAgdmFyIHF1ZXJ5ID0gbmV3IGdvb2dsZS52aXN1YWxpemF0aW9uLlF1ZXJ5KHVybFByZWZpeCtodWNJZCt1cmxQb3N0aXgpO1xuICBxdWVyeS5zZXRUaW1lb3V0KDYwKjUpOyAvLyA1IG1pbiB0aW1lb3V0XG4gIHF1ZXJ5LnNlbmQoZnVuY3Rpb24ocmVzcG9uc2Upe1xuICAgIGlmIChyZXNwb25zZS5pc0Vycm9yKCkgKSByZXR1cm4gYWxlcnQoJ0Vycm9yIHJldHJpZXZpbmcgSFVDIDEyIGRhdGEgZm9yIGlkIFwiJytodWNJZCsnXCInKTtcblxuICAgIHZhciBkYXRhID0gcmVzcG9uc2UuZ2V0RGF0YVRhYmxlKCk7XG5cbiAgICBpZiggZGF0YS5nZXROdW1iZXJPZlJvd3MoKSA9PSAwICkge1xuICAgICAgZGVidWdnZXI7XG4gICAgICByZXR1cm4gYWxlcnQoJ0Vycm9yOiBpbnZhbGlkIEhVQyAxMiBpZCBcIicraHVjSWQrXCInXCIpO1xuICAgIH1cblxuICAgIHZhciBnZW9tZXRyeSA9IEpTT04ucGFyc2UoZGF0YS5nZXRWYWx1ZSgwLCAwKSk7XG4gICAgdmFyIGdlb2pzb25GZWF0dXJlID0ge1xuICAgICAgXCJ0eXBlXCI6IFwiRmVhdHVyZVwiLFxuICAgICAgXCJwcm9wZXJ0aWVzXCI6IHtcbiAgICAgICAgICBcImlkXCI6IGh1Y0lkLFxuICAgICAgfSxcbiAgICAgIFwiZ2VvbWV0cnlcIjogZ2VvbWV0cnlcbiAgICB9O1xuICAgIGh1Y0NhY2hlW2h1Y0lkXSA9IGdlb2pzb25GZWF0dXJlO1xuXG4gICAgcmVuZGVySHVjKGh1Y0lkKTtcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIHJlbmRlckh1YyhpZCkge1xuICBpZiggIXNob3dpbmcgKSByZXR1cm47XG5cbiAgdmFyIHBvaW50cyA9IHBvaW50c0J5SHVjW2lkXTtcblxuICAvLyBjYWxjdWxhdGUgcGVyY2VudCBkZW1hbmRcbiAgdmFyIHBlcmNlbnREZW1hbmRzID0gW10sIGZlYXR1cmU7XG4gIGZvciggdmFyIGkgPSAwOyBpIDwgcG9pbnRzLmxlbmd0aDsgaSsrICkge1xuICAgIGZlYXR1cmUgPSBwb2ludHNbaV07XG5cbiAgICBpZiggZmVhdHVyZS5wcm9wZXJ0aWVzLmFsbG9jYXRpb25zICYmIGZlYXR1cmUucHJvcGVydGllcy5hbGxvY2F0aW9ucy5sZW5ndGggPiAwICkge1xuICAgICAgdmFyIGRlbWFuZCA9IGZlYXR1cmUucHJvcGVydGllcy5hbGxvY2F0aW9uc1swXS5kZW1hbmQ7XG4gICAgICB2YXIgYWxsb2NhdGlvbiA9IGZlYXR1cmUucHJvcGVydGllcy5hbGxvY2F0aW9uc1swXS5hbGxvY2F0aW9uO1xuXG4gICAgICBpZiggZGVtYW5kICE9IDAgKSB7XG4gICAgICAgIHBlcmNlbnREZW1hbmRzLnB1c2goYWxsb2NhdGlvbiAvIGRlbWFuZCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gY2FsYyBhdmVyYWdlXG4gIHZhciBhdmdQcmVjZW50RGVtYW5kID0gLTE7XG4gIHZhciB0bXAgPSAwO1xuICBmb3IoIHZhciBpID0gMDsgaSA8IHBlcmNlbnREZW1hbmRzLmxlbmd0aDsgaSsrICkge1xuICAgIHRtcCArPSBwZXJjZW50RGVtYW5kc1tpXTtcbiAgfVxuICBpZiggcGVyY2VudERlbWFuZHMubGVuZ3RoID4gMCApIGF2Z1ByZWNlbnREZW1hbmQgPSB0bXAgLyBwZXJjZW50RGVtYW5kcy5sZW5ndGg7XG5cbiAgdmFyIGxheWVyID0gTC5nZW9Kc29uKFxuICAgIGh1Y0NhY2hlW2lkXSxcbiAgICB7XG4gICAgICBzdHlsZTogZnVuY3Rpb24oZmVhdHVyZSkge1xuICAgICAgICByZXR1cm4gcmVuZGVyUGVyY2VudERlbWFuZEh1YyhhdmdQcmVjZW50RGVtYW5kKTtcbiAgICAgIH1cbiAgICB9XG4gICkuYWRkVG8obWFwKTtcblxuICBsYXllcnMucHVzaChsYXllcik7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBpbml0IDogaW5pdCxcbiAgcmVuZGVyIDogcmVuZGVyXG59O1xuIiwiXG52YXIgbWFwLCBnZW9Kc29uTGF5ZXI7XG52YXIgd21zTGF5ZXJzID0gW107XG52YXIgYWxsRGF0YSA9IFtdO1xuXG4vLyBzaG91bGQgYmUgZmlsbGVkIG9yIGVtcHR5O1xudmFyIHJlbmRlckRlbWFuZCA9ICdlbXB0eSc7XG52YXIgY3VycmVudFBvaW50cyA9IG51bGw7XG52YXIgbGFzdFJlc3BQb2ludHMgPSBudWxsO1xuXG52YXIgbWFwID0gcmVxdWlyZSgnLi9tYXAnKTtcbnZhciBodWMgPSByZXF1aXJlKCcuL2h1YycpO1xudmFyIGZpbGUgPSByZXF1aXJlKCcuL2ZpbGUnKTtcblxuJChkb2N1bWVudCkub24oJ3JlYWR5JywgZnVuY3Rpb24oKXtcbiAgcmVzaXplKCk7XG4gIGluaXQoKTtcbn0pO1xuXG4kKHdpbmRvdylcbiAgLm9uKCdyZXNpemUnLCByZXNpemUpO1xuXG5mdW5jdGlvbiBpbml0KCkge1xuICBtYXAuaW5pdCgpO1xuICBodWMuaW5pdChtYXAuZ2V0TGVhZmxldCgpKTtcblxuICBmaWxlLnNldHVwKCk7IC8vIHNldHVwIGRvbSBoYW5kbGVycyBmb3IgZmlsZVxuXG4gIG1hcC5sZWdlbmQuaW5pdCgpO1xuICBtYXAuc2V0SHVjKGh1Yyk7XG59XG5cbmZ1bmN0aW9uIHJlc2l6ZSgpIHtcbiAgLy8gd2h5IGlzIHRoaXMgbm90IHdvcmtpbmc/Pz9cbiAgLy8kKCcjbWFwJykuaGVpZ2h0KCQod2luZG93KS5oZWlnaHQoKSlcbiAgLy8gICAgIC53aWR0aCgkKHdpbmRvdykud2lkdGgoKSk7XG5cbiAgdmFyIGggPSB3aW5kb3cuaW5uZXJIZWlnaHQ7XG4gIHZhciB3ID0gd2luZG93LmlubmVyV2lkdGg7XG4gIGlmKCBoID09PSBudWxsICkgaCA9ICQod2luZG93KS5oZWlnaHQoKTtcbiAgaWYoIHcgPT09IG51bGwgKSB3ID0gJCh3aW5kb3cpLndpZHRoKCk7XG5cbiAgJCgnI21hcCcpLmhlaWdodChoKS53aWR0aCh3KTtcbiAgJCgnI2luZm8nKS5jc3MoJ21heC1oZWlnaHQnLCAoaC04NSkrJ3B4Jyk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBtYXAgOiBtYXAsXG4gIGh1YyA6IGh1YyxcbiAgZmlsZSA6IGZpbGVcbn07XG4iLCJ2YXIgRHJvdWdodEljb24gPSByZXF1aXJlKCcuLi9tYXJrZXJzL2Ryb3VnaHRJY29uJyk7XG52YXIgbWFya2VyQ29uZmlnID0gcmVxdWlyZSgnLi4vbWFya2Vycy9jb25maWcnKTtcbnZhciBtYXJrZXJzID0gbWFya2VyQ29uZmlnLmRlZmF1bHRzO1xudmFyIG1hcDtcblxubW9kdWxlLmV4cG9ydHMuaW5pdCA9IGZ1bmN0aW9uKG0pIHtcbiAgbWFwID0gbTtcblxuICB2YXIgZGVtYW5kU3RlcHMgPSBbMCwgMSwgNTAsIDEwMCwgMjUwXTtcblxuICB2YXIgb3B0aW9ucyA9ICQuZXh0ZW5kKHRydWUsIHt9LCBtYXJrZXJzLnJpcGFyaWFuLnVuYWxsb2NhdGVkKTtcbiAgb3B0aW9ucy5zaWRlcyA9IDA7XG4gIHZhciBpY29uID0gbmV3IERyb3VnaHRJY29uKG9wdGlvbnMpO1xuICAkKCcjbGVnZW5kLXJpcGFyaWFuJykuYXBwZW5kKCQoaWNvbi5lbGUpKTtcblxuXG4gIG9wdGlvbnMgPSAkLmV4dGVuZCh0cnVlLCB7fSwgbWFya2Vycy5hcHBsaWNhdGlvbi51bmFsbG9jYXRlZCk7XG4gIG9wdGlvbnMuc2lkZXMgPSAzO1xuICBvcHRpb25zLnJvdGF0ZSA9IDkwO1xuICBpY29uID0gbmV3IERyb3VnaHRJY29uKG9wdGlvbnMpO1xuICAkKCcjbGVnZW5kLXByZS1hcHByb3ByaWF0aXZlJykuYXBwZW5kKCQoaWNvbi5lbGUpKTtcblxuICBpY29uID0gbmV3IERyb3VnaHRJY29uKG1hcmtlcnMuYXBwbGljYXRpb24udW5hbGxvY2F0ZWQpO1xuICAkKCcjbGVnZW5kLXBvc3QtYXBwcm9wcmlhdGl2ZScpLmFwcGVuZCgkKGljb24uZWxlKSk7XG5cbiAgdmFyIHRhYmxlID0gJzx0YWJsZSBzdHlsZT1cInRleHQtYWxpZ246Y2VudGVyXCI+PHRyIHN0eWxlPVwidmVydGljYWwtYWxpZ246IGJvdHRvbVwiPic7XG4gIHZhciBpY29ucyA9IFtdO1xuICBmb3IoIHZhciBpID0gMDsgaSA8IGRlbWFuZFN0ZXBzLmxlbmd0aDsgaSsrICkge1xuICAgIHRhYmxlICs9ICc8dGQgc3R5bGU9XCJwYWRkaW5nOjRweFwiPjxkaXYgaWQ9XCJsZWdlbmQtZGVtYW5kLScraSsnXCI+PC9kaXY+PGRpdj4nK1xuICAgICAgICAgICAgICAoZGVtYW5kU3RlcHNbaV0gPT0gMSA/ICc8JyA6ICcnKSArXG4gICAgICAgICAgICAgIChkZW1hbmRTdGVwc1tpXSA9PSAyNTAgPyAnPicgOiAnJykgK1xuICAgICAgICAgICAgICBkZW1hbmRTdGVwc1tpXSsnPC9kaXY+PC90ZD4nO1xuXG5cbiAgICBpZiggZGVtYW5kU3RlcHNbaV0gPT09IDAgKSB7XG4gICAgICBvcHRpb25zID0gJC5leHRlbmQodHJ1ZSwge30sIG1hcmtlcnMuYXBwbGljYXRpb24udW5hbGxvY2F0ZWQpO1xuICAgICAgb3B0aW9ucyA9ICQuZXh0ZW5kKHRydWUsIG9wdGlvbnMsIG1hcmtlcnMubm9EZW1hbmQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBvcHRpb25zID0gJC5leHRlbmQodHJ1ZSwge30sIG1hcmtlcnMuYXBwbGljYXRpb24udW5hbGxvY2F0ZWQpO1xuXG4gICAgICB2YXIgc2l6ZSA9IE1hdGguc3FydChkZW1hbmRTdGVwc1tpXSkgKiAzO1xuICAgICAgaWYoIHNpemUgPiA1MCApIHNpemUgPSA1MDtcbiAgICAgIGlmKCBzaXplIDwgNyApIHNpemUgPSA3O1xuXG4gICAgICBvcHRpb25zLmhlaWdodCA9IChzaXplKjIpKzI7XG4gICAgICBvcHRpb25zLndpZHRoID0gKHNpemUqMikrMjtcbiAgICB9XG5cbiAgICBpY29ucy5wdXNoKG5ldyBEcm91Z2h0SWNvbihvcHRpb25zKSk7XG4gIH1cbiAgJCgnI2xlZ2VuZC1kZW1hbmQnKS5odG1sKHRhYmxlKyc8L3RyPjwvdGFibGU+Jyk7XG5cbiAgZm9yKCBpID0gMDsgaSA8IGljb25zLmxlbmd0aDsgaSsrICkge1xuICAgICQoJyNsZWdlbmQtZGVtYW5kLScraSkuYXBwZW5kKCQoaWNvbnNbaV0uZWxlKSk7XG4gIH1cblxuICB0aGlzLnJlZHJhd1BEZW1hbmRMZWdlbmQoKTtcblxuICAvLyBpbml0IHRvZ2dsZSBidXR0b25cblxuICAkKCcjbGVnZW5kVG9nZ2xlJykub24oJ2NsaWNrJywgZnVuY3Rpb24oKXtcbiAgICBpZiggdGhpcy5oYXNBdHRyaWJ1dGUoJ3Nob3dpbmcnKSApIHtcbiAgICAgIHRoaXMucmVtb3ZlQXR0cmlidXRlKCdzaG93aW5nJyk7XG4gICAgICAkKCcjbGVnZW5kJykuaGlkZSgnc2xvdycpO1xuICAgICAgdGhpcy5pbm5lckhUTUwgPSAnPGkgY2xhc3M9XCJmYSBmYS1hcnJvdy1yaWdodFwiPjwvaT4nO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuc2V0QXR0cmlidXRlKCdzaG93aW5nJywgJycpO1xuICAgICAgJCgnI2xlZ2VuZCcpLnNob3coJ3Nsb3cnKTtcbiAgICAgIHRoaXMuaW5uZXJIVE1MID0gJzxpIGNsYXNzPVwiZmEgZmEtYXJyb3ctZG93blwiPjwvaT4nO1xuICAgIH1cbiAgfSk7XG5cbiAgJCgnI3JlbmRlclR5cGVGaWxsZWQnKS5vbignY2xpY2snLCBvblJlbmRlclR5cGVDaGFuZ2UpO1xuICAkKCcjcmVuZGVyVHlwZUVtcHR5Jykub24oJ2NsaWNrJywgb25SZW5kZXJUeXBlQ2hhbmdlKTtcblxuICAkKCcjc2hvd05vRGVtYW5kJykub24oJ2NsaWNrJywgZnVuY3Rpb24oKXtcbiAgICBpZiggZ2VvSnNvbkxheWVyICkge1xuICAgICAgbWFwLnJlbW92ZUxheWVyKGdlb0pzb25MYXllcik7XG4gICAgICBnZW9Kc29uTGF5ZXIgPSBudWxsO1xuICAgICAgYWxsRGF0YSA9IFtdO1xuICAgIH1cblxuICAgIGFkZEdlb0pzb24obGFzdFJlc3BQb2ludHMpO1xuICB9KTtcbn07XG5cbm1vZHVsZS5leHBvcnRzLnJlZHJhd1BEZW1hbmRMZWdlbmQgPSBmdW5jdGlvbigpIHtcbiAgdmFyIHBlcmNlbnRTdGVwcyA9IFswLCAyNSwgNTAsIDc1LCAxMDBdLCBpO1xuXG4gIHZhciB0YWJsZSA9ICc8dGFibGUgc3R5bGU9XCJ0ZXh0LWFsaWduOmNlbnRlclwiPjx0ciBzdHlsZT1cInZlcnRpY2FsLWFsaWduOiBib3R0b21cIj4nO1xuICB2YXIgaWNvbnMgPSBbXTtcblx0Zm9yKCBpID0gMDsgaSA8IHBlcmNlbnRTdGVwcy5sZW5ndGg7IGkrKyApIHtcblx0XHR0YWJsZSArPSAnPHRkIHN0eWxlPVwicGFkZGluZzo4cHhcIj48ZGl2IGlkPVwibGVnZW5kLXByZWNlbnQtb2YtZGVtYW5kLScraSsnXCI+PC9kaXY+PGRpdj4nK1xuXHRcdFx0XHRcdHBlcmNlbnRTdGVwc1tpXSsnJTwvZGl2PjwvdGQ+JztcblxuXHRcdHZhciBvcHRpb25zID0gJC5leHRlbmQodHJ1ZSwge30sIG1hcmtlcnMuYXBwbGljYXRpb24udW5hbGxvY2F0ZWQpO1xuXG4gICAgbWFya2VyQ29uZmlnLnBlcmNlbnREZW1hbmQob3B0aW9ucywgcGVyY2VudFN0ZXBzW2ldIC8gMTAwKTtcblxuXHRcdGljb25zLnB1c2gobmV3IERyb3VnaHRJY29uKG9wdGlvbnMpKTtcblx0fVxuXHQkKCcjbGVnZW5kLXByZWNlbnQtb2YtZGVtYW5kJykuaHRtbCh0YWJsZSsnPC90cj48L3RhYmxlPicpO1xuXG5cdGZvciggaSA9IDA7IGkgPCBpY29ucy5sZW5ndGg7IGkrKyApIHtcblx0XHQkKCcjbGVnZW5kLXByZWNlbnQtb2YtZGVtYW5kLScraSkuYXBwZW5kKCQoaWNvbnNbaV0uZWxlKSk7XG5cdH1cbn07XG5cbmZ1bmN0aW9uIG9uUmVuZGVyVHlwZUNoYW5nZSgpIHtcbiAgdmFyIGlzRmlsbGVkQ2hlY2tlZCA9ICQoJyNyZW5kZXJUeXBlRmlsbGVkJykuaXMoJzpjaGVja2VkJyk7XG4gIHZhciBuZXdWYWwgPSBpc0ZpbGxlZENoZWNrZWQgPyAnZmlsbGVkJyA6ICdlbXB0eSc7XG5cbiAgaWYoIHJlbmRlckRlbWFuZCA9PSBuZXdWYWwgKSByZXR1cm47XG4gIHJlbmRlckRlbWFuZCA9IG5ld1ZhbDtcblxuICAvLyByZW5kZXIgbGVnZW5kXG4gIHRoaXMucmVkcmF3UERlbWFuZExlZ2VuZCgpO1xuXG4gIGlmKCAhY3VycmVudFBvaW50cyApIHJldHVybjtcblxuICBpZiggZ2VvSnNvbkxheWVyICkge1xuICAgIG1hcC5yZW1vdmVMYXllcihnZW9Kc29uTGF5ZXIpO1xuICAgIGdlb0pzb25MYXllciA9IG51bGw7XG4gICAgYWxsRGF0YSA9IFtdO1xuICB9XG4gIG1hcC5hZGRHZW9Kc29uKGN1cnJlbnRQb2ludHMpO1xufTtcblxuZnVuY3Rpb24gc3RhbXAoZGF0YSkge1xuICB2YXIgdGVtcGxhdGUgPSBtYXJrZXJUZW1wbGF0ZTtcbiAgZm9yKCB2YXIga2V5IGluIGRhdGEgKSB0ZW1wbGF0ZSA9IHRlbXBsYXRlLnJlcGxhY2UoJ3t7JytrZXkrJ319JywgZGF0YVtrZXldKTtcbiAgcmV0dXJuIHRlbXBsYXRlO1xufVxuIiwidmFyIG1hcmtlckNvbmZpZyA9IHJlcXVpcmUoJy4uL21hcmtlcnMvY29uZmlnJyk7XG5cbnZhciBnZW9Kc29uTGF5ZXI7XG52YXIgbWFwLCBodWM7XG5cbm1vZHVsZS5leHBvcnRzLmluaXQgPSBmdW5jdGlvbihjb25maWcpIHtcbiAgbWFwID0gY29uZmlnLm1hcDtcbiAgaHVjID0gY29uZmlnLmh1Yztcbn07XG5cbm1vZHVsZS5leHBvcnRzLmFkZCA9IGZ1bmN0aW9uKHBvaW50cykge1xuICB2YXIgc2hvd05vRGVtYW5kID0gJCgnI3Nob3dOb0RlbWFuZCcpLmlzKCc6Y2hlY2tlZCcpO1xuXG4gIGlmKCAhc2hvd05vRGVtYW5kICkge1xuICAgIHRtcCA9IFtdO1xuICAgIGZvciggdmFyIGkgPSBwb2ludHMubGVuZ3RoLTE7IGkgPj0gMDsgaS0tICkge1xuICAgICAgaWYoIHBvaW50c1tpXS5wcm9wZXJ0aWVzLmFsbG9jYXRpb25zICYmIHBvaW50c1tpXS5wcm9wZXJ0aWVzLmFsbG9jYXRpb25zLmxlbmd0aCA+IDAgKSB7XG5cbiAgICAgICAgdmFyIGRlbWFuZCA9IHBvaW50c1tpXS5wcm9wZXJ0aWVzLmFsbG9jYXRpb25zWzBdLmRlbWFuZDtcbiAgICAgICAgaWYoIGRlbWFuZCAhPT0gMCApIHRtcC5wdXNoKHBvaW50c1tpXSk7XG4gICAgICB9XG4gICAgfVxuICAgIHBvaW50cyA9IHRtcDtcbiAgfVxuXG4gIGdlb0pzb25MYXllciA9IEwuZ2VvSnNvbihwb2ludHMse1xuICAgIHBvaW50VG9MYXllcjogZnVuY3Rpb24gKGZlYXR1cmUsIGxhdGxuZykge1xuICAgICAgdmFyIHR5cGUgPSBmZWF0dXJlLnByb3BlcnRpZXMucmlwYXJpYW4gPyAncmlwYXJpYW4nIDogJ2FwcGxpY2F0aW9uJztcbiAgICAgIHZhciBhbGxvY2F0aW9uID0gJ3VuYWxsb2NhdGVkJztcblxuICAgICAgZm9yKCB2YXIgaSA9IDA7IGkgPCBmZWF0dXJlLnByb3BlcnRpZXMuYWxsb2NhdGlvbnMubGVuZ3RoOyBpKysgKSB7XG4gICAgICAgIGlmKCBmZWF0dXJlLnByb3BlcnRpZXMuYWxsb2NhdGlvbnNbaV0uYWxsb2NhdGlvbiA+IDAgKSBhbGxvY2F0aW9uID0gJ2FsbG9jYXRlZCc7XG4gICAgICB9XG5cblxuICAgICAgdmFyIG9wdGlvbnMgPSAkLmV4dGVuZCh0cnVlLCB7fSwgbWFya2Vyc1t0eXBlXVthbGxvY2F0aW9uXSk7XG5cbiAgICAgIGlmKCBmZWF0dXJlLnByb3BlcnRpZXMuYWxsb2NhdGlvbnMgJiYgZmVhdHVyZS5wcm9wZXJ0aWVzLmFsbG9jYXRpb25zLmxlbmd0aCA+IDAgKSB7XG5cbiAgICAgICAgdmFyIGRlbWFuZCA9IGZlYXR1cmUucHJvcGVydGllcy5hbGxvY2F0aW9uc1swXS5kZW1hbmQ7XG4gICAgICAgIHZhciBhbGxvY2F0aW9uID0gZmVhdHVyZS5wcm9wZXJ0aWVzLmFsbG9jYXRpb25zWzBdLmFsbG9jYXRpb247XG5cbiAgICAgICAgaWYoIGRlbWFuZCA9PT0gMCApIHtcblxuICAgICAgICAgICQuZXh0ZW5kKHRydWUsIG9wdGlvbnMsIG1hcmtlcnMubm9EZW1hbmQpO1xuICAgICAgICAgIGZlYXR1cmUucHJvcGVydGllcy5ub0RlbWFuZCA9IHRydWU7XG5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBtYXJrZXJDb25maWcucmVuZGVyUGVyY2VudERlbWFuZChvcHRpb25zLCBhbGxvY2F0aW9uIC8gZGVtYW5kKTtcblxuICAgICAgICAgIHZhciBzaXplID0gTWF0aC5zcXJ0KGRlbWFuZCkgKiAzO1xuICAgICAgICAgIGlmKCBzaXplID4gNTAgKSBzaXplID0gNTA7XG4gICAgICAgICAgaWYoIHNpemUgPCA3ICkgc2l6ZSA9IDc7XG5cbiAgICAgICAgICBvcHRpb25zLmhlaWdodCA9IHNpemUqMjtcbiAgICAgICAgICBvcHRpb25zLndpZHRoID0gc2l6ZSoyO1xuICAgICAgICB9XG4gICAgICB9XG5cblxuXG4gICAgICB2YXIgbWFya2VyO1xuICAgICAgdmFyIGQ7XG4gICAgICB0cnkge1xuICAgICAgICBkID0gZmVhdHVyZS5wcm9wZXJ0aWVzLnByaW9yaXR5X2RhdGUgPyBwYXJzZUludChmZWF0dXJlLnByb3BlcnRpZXMucHJpb3JpdHlfZGF0ZS5yZXBsYWNlKC8tLiovLCcnKSkgOiAyMDAwO1xuICAgICAgfSBjYXRjaChlKSB7XG4gICAgICAgIGQgPSAyMDAwO1xuICAgICAgfVxuXG4gICAgICBpZiggZmVhdHVyZS5wcm9wZXJ0aWVzLnJpcGFyaWFuICkge1xuICAgICAgICBvcHRpb25zLnNpZGVzID0gMDtcbiAgICAgICAgbWFya2VyID0gTC5sZWFmbGV0TWFya2VyKGxhdGxuZywgb3B0aW9ucyk7XG4gICAgICB9IGVsc2UgaWYgKCBkIDwgMTkxNCApIHtcbiAgICAgICAgb3B0aW9ucy5zaWRlcyA9IDM7XG4gICAgICAgIG9wdGlvbnMucm90YXRlID0gOTA7XG4gICAgICAgIG1hcmtlciA9IEwubGVhZmxldE1hcmtlcihsYXRsbmcsIG9wdGlvbnMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbWFya2VyID0gTC5sZWFmbGV0TWFya2VyKGxhdGxuZywgb3B0aW9ucyk7XG4gICAgICB9XG5cbiAgICAgIGFsbERhdGEucHVzaCh7XG4gICAgICAgIGZlYXR1cmUgOiBmZWF0dXJlLFxuICAgICAgICBtYXJrZXIgIDogbWFya2VyXG4gICAgICB9KTtcbiAgICAgIHJldHVybiBtYXJrZXI7XG4gICAgfVxuICB9KS5hZGRUbyhtYXApO1xuXG4gIGdlb0pzb25MYXllci5vbignY2xpY2snLCBmdW5jdGlvbihlKSB7XG4gICAgJCgnLnNlbGVjdC10ZXh0JykucmVtb3ZlKCk7XG4gICAgJCgnI2luZm8nKS5zaG93KCk7XG4gICAgdmFyIHByb3BzID0gZS5sYXllci5mZWF0dXJlLnByb3BlcnRpZXM7XG5cbiAgICBzZWxlY3QoZS5sYXllcik7XG5cbiAgICB2YXIgbGwgPSBlLmxheWVyLmZlYXR1cmUuZ2VvbWV0cnkuY29vcmRpbmF0ZXM7XG5cbiAgICB2YXIgdCwgaHRtbCA9ICcnO1xuICAgIGZvciggdmFyIGkgPSAwOyBpIDwgYWxsRGF0YS5sZW5ndGg7IGkrKyApIHtcbiAgICAgIHQgPSBhbGxEYXRhW2ldLmZlYXR1cmUuZ2VvbWV0cnkuY29vcmRpbmF0ZXM7XG4gICAgICBpZiggbGxbMF0udG9GaXhlZCg0KSA9PSB0WzBdLnRvRml4ZWQoNCkgJiYgbGxbMV0udG9GaXhlZCg0KSA9PSB0WzFdLnRvRml4ZWQoNCkgKSB7XG4gICAgICAgIHZhciBwID0gYWxsRGF0YVtpXS5mZWF0dXJlLnByb3BlcnRpZXM7XG5cbiAgICAgICAgaHRtbCArPSBzdGFtcCh7XG4gICAgICAgICAgYXBwbGljYXRpb25fbnVtYmVyIDogcC5hcHBsaWNhdGlvbl9udW1iZXIsXG4gICAgICAgICAgZGF0ZSA6IHAuYWxsb2NhdGlvbnNbMF0uZGF0ZSxcbiAgICAgICAgICBhbGxvY2F0aW9uIDogcC5hbGxvY2F0aW9uc1swXS5hbGxvY2F0aW9uLFxuICAgICAgICAgIGRlbWFuZCA6IHAuYWxsb2NhdGlvbnNbMF0uZGVtYW5kLFxuICAgICAgICAgIHJhdGlvIDogcC5hbGxvY2F0aW9uc1swXS5yYXRpbyAhPT0gbnVsbCA/IChwLmFsbG9jYXRpb25zWzBdLnJhdGlvKjEwMCkudG9GaXhlZCgyKSA6ICcxMDAnLFxuICAgICAgICAgIHdhdGVyX3JpZ2h0X3R5cGUgOiBwWydSaWdodCBUeXBlJ10sXG4gICAgICAgICAgcHJpb3JpdHlfZGF0ZSA6IHAucHJpb3JpdHlfZGF0ZSA/IHAucHJpb3JpdHlfZGF0ZSA6ICdVbmtub3duJ1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG5cblxuICAgICQoJyNpbmZvLXJlc3VsdCcpLmh0bWwoaHRtbCk7XG4gICAgJCgnI2luZm8nKS5hbmltYXRlKHtcbiAgICAgIHNjcm9sbFRvcDogJCgnLmluZm8tYm94JykuaGVpZ2h0KClcbiAgICB9LCAzMDApO1xuICB9KTtcblxuICBjdXJyZW50UG9pbnRzID0gcG9pbnRzO1xuXG4gIGh1Yy5yZW5kZXIocG9pbnRzKTtcbn07XG4iLCJ2YXIgbWFwO1xudmFyIGJhc2VNYXBzID0ge307XG52YXIgb3ZlcmxheU1hcHMgPSB7fTtcblxudmFyIGdlb2pzb24gPSByZXF1aXJlKCcuL2dlb2pzb24nKTtcbm1vZHVsZS5leHBvcnRzLmxlZ2VuZCA9IHJlcXVpcmUoJy4uL2xlZ2VuZCcpO1xubW9kdWxlLmV4cG9ydHMuZ2VvanNvbiA9IHJlcXVpcmUoJy4vZ2VvanNvbicpO1xuXG5tb2R1bGUuZXhwb3J0cy5pbml0ID0gZnVuY3Rpb24oKSB7XG4gIG1hcCA9IEwubWFwKCdtYXAnLHt0cmFja1Jlc2l6ZTp0cnVlfSk7XG5cbiAgLy8gYWRkIGFuIE9wZW5TdHJlZXRNYXAgdGlsZSBsYXllclxuICBMLnRpbGVMYXllcignaHR0cDovL3tzfS50aWxlLm9zbS5vcmcve3p9L3t4fS97eX0ucG5nJywge1xuICAgICAgYXR0cmlidXRpb246ICcmY29weTsgPGEgaHJlZj1cImh0dHA6Ly9vc20ub3JnL2NvcHlyaWdodFwiPk9wZW5TdHJlZXRNYXA8L2E+IGNvbnRyaWJ1dG9ycydcbiAgfSkuYWRkVG8obWFwKTtcblxuICB2YXIgd21zMSA9IEwudGlsZUxheWVyLndtcyhcImh0dHBzOi8vbWFwc2VuZ2luZS5nb29nbGUuY29tLzE1NTQyNjAwNzM0Mjc1NTQ5NDQ0LTExODUzNjY3MjczMTMxNTUwMzQ2LTQvd21zLz92ZXJzaW9uPTEuMy4wXCIsIHtcbiAgICAgIGxheWVyczogJzE1NTQyNjAwNzM0Mjc1NTQ5NDQ0LTA4MTEyOTc0NjkwOTkxMTY0NTg3LTQnLFxuICAgICAgZm9ybWF0OiAnaW1hZ2UvcG5nJyxcbiAgICAgIHRyYW5zcGFyZW50OiB0cnVlLFxuICAgICAgYXR0cmlidXRpb246IFwiXCIsXG4gICAgICBib3VuZHMgOiBMLmxhdExuZ0JvdW5kcyhcbiAgICAgICAgTC5sYXRMbmcoNDIuMDA5NDMxOTg4MDQwNTgsIC0xMTQuMTMwNzU5NzIxMzQwNyksXG4gICAgICAgIEwubGF0TG5nKDMyLjUzNDI2MzQ1MzY3NDkzLCAtMTI0LjQwOTcxMTcxNjc4Mjk4KVxuICAgICAgKVxuICB9KS5hZGRUbyhtYXApO1xuXG4gIHZhciB3bXMyID0gTC50aWxlTGF5ZXIud21zKFwiaHR0cHM6Ly9tYXBzZW5naW5lLmdvb2dsZS5jb20vMTU1NDI2MDA3MzQyNzU1NDk0NDQtMTE4NTM2NjcyNzMxMzE1NTAzNDYtNC93bXMvP3ZlcnNpb249MS4zLjBcIiwge1xuICAgICAgbGF5ZXJzOiAnMTU1NDI2MDA3MzQyNzU1NDk0NDQtMTYxNDMxNTg2ODk2MDMzNjEwOTMtNCcsXG4gICAgICBmb3JtYXQ6ICdpbWFnZS9wbmcnLFxuICAgICAgdHJhbnNwYXJlbnQ6IHRydWUsXG4gICAgICBhdHRyaWJ1dGlvbjogXCJcIixcbiAgICAgIGJvdW5kcyA6IEwubGF0TG5nQm91bmRzKFxuICAgICAgICBMLmxhdExuZyg0Mi4wMDk0MzE5ODgwNDA1OCwgLTExNC4xMzA3NTk3MjEzNDA3KSxcbiAgICAgICAgTC5sYXRMbmcoMzIuNTM0MjYzNDUzNjc0OTMsIC0xMjQuNDA5NzExNzE2NzgyOTgpXG4gICAgICApXG4gIH0pO1xuXG4gIGJhc2VNYXBzID0ge307XG4gIG92ZXJsYXlNYXBzID0ge1xuICAgICdXYXRlcnNoZWRzJzogd21zMSxcbiAgICAnSFVDIDEyJzogd21zMlxuICB9O1xuXG4gIEwuY29udHJvbC5sYXllcnMoYmFzZU1hcHMsIG92ZXJsYXlNYXBzLCB7cG9zaXRpb246ICdib3R0b21sZWZ0J30pLmFkZFRvKG1hcCk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cy5zZXRIdWMgPSBmdW5jdGlvbihodWMpIHtcbiAgZ2VvanNvbi5pbml0KHtcbiAgICBodWMgOiBodWMsXG4gICAgbWFwIDogbWFwXG4gIH0pO1xufTtcblxubW9kdWxlLmV4cG9ydHMuZ2V0TGVhZmxldCA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gbWFwO1xufTtcbiIsInZhciBtYXJrZXJzID0ge1xuICByaXBhcmlhbiA6IHtcbiAgICBhbGxvY2F0ZWQgOiB7XG4gICAgICBmaWxsQ29sb3IgICA6IFwiIzI1MjVDOVwiLFxuICAgICAgY29sb3IgICAgICAgOiBcIiMzMzMzMzNcIixcbiAgICAgIHdlaWdodCAgICAgIDogMSxcbiAgICAgIG9wYWNpdHkgICAgIDogMSxcbiAgICAgIGZpbGxPcGFjaXR5IDogMC4zLFxuXHRcdFx0c2lkZXMgOiAzLFxuXHRcdFx0cm90YXRlIDogOTAsXG4gICAgICB3aWR0aDogMjAsXG4gICAgICBoZWlnaHQ6IDIwXG4gICAgfSxcbiAgICB1bmFsbG9jYXRlZCA6IHtcbiAgICAgIGZpbGxDb2xvciAgIDogXCIjZmZmZmZmXCIsXG4gICAgICBjb2xvciAgICAgICA6IFwiIzMzMzMzM1wiLFxuICAgICAgd2VpZ2h0ICAgICAgOiAxLFxuICAgICAgb3BhY2l0eSAgICAgOiAxLFxuICAgICAgZmlsbE9wYWNpdHkgOiAwLjMsXG5cdFx0XHRzaWRlcyA6IDMsXG5cdFx0XHRyb3RhdGUgOiA5MCxcbiAgICAgIHdpZHRoOiAyMCxcbiAgICAgIGhlaWdodDogMjBcbiAgICB9XG4gIH0sXG4gIGFwcGxpY2F0aW9uIDoge1xuICAgIGFsbG9jYXRlZCA6IHtcbiAgICAgIGZpbGxDb2xvciAgIDogXCIjMjUyNUM5XCIsXG4gICAgICBjb2xvciAgICAgICA6IFwiIzMzMzMzM1wiLFxuICAgICAgd2VpZ2h0ICAgICAgOiAxLFxuICAgICAgb3BhY2l0eSAgICAgOiAxLFxuICAgICAgZmlsbE9wYWNpdHkgOiAwLjMsXG4gICAgICBzaWRlcyAgICAgICA6IDQsXG4gICAgICByb3RhdGUgICAgICA6IDQ1LFxuICAgICAgd2lkdGg6IDIwLFxuICAgICAgaGVpZ2h0OiAyMFxuICAgIH0sXG4gICAgdW5hbGxvY2F0ZWQgOiB7XG4gICAgICBmaWxsQ29sb3IgICA6IFwiI2ZmZmZmZlwiLFxuICAgICAgY29sb3IgICAgICAgOiBcIiMzMzMzMzNcIixcbiAgICAgIHdlaWdodCAgICAgIDogMSxcbiAgICAgIG9wYWNpdHkgICAgIDogMSxcbiAgICAgIGZpbGxPcGFjaXR5IDogMC4zLFxuICAgICAgc2lkZXMgICAgICAgOiA0LFxuICAgICAgcm90YXRlICAgICAgOiA0NSxcbiAgICAgIHdpZHRoOiAyMCxcbiAgICAgIGhlaWdodDogMjBcbiAgICB9XG4gIH0sXG4gIG5vRGVtYW5kIDoge1xuICAgIG5vRmlsbCA6IHRydWUsXG4gICAgLy9zaWRlcyA6IDAsXG4gICAgY29sb3IgOiBcIiMzMzMzMzNcIixcbiAgICBzdHJpa2V0aHJvdWdoIDogdHJ1ZSxcbiAgICByYWRpdXMgOiA1LFxuICAgIGhlaWdodCA6IDEyLFxuICAgIHdpZHRoIDogMTJcbiAgfVxufTtcbm1vZHVsZS5leHBvcnRzLmRlZmF1bHRzID0gbWFya2VycztcblxubW9kdWxlLmV4cG9ydHMucGVyY2VudERlbWFuZCA9IGZ1bmN0aW9uKG9wdGlvbnMsIHBlcmNlbnQsIG5vRGVtYW5kKSB7XG4gIGlmKCBub0RlbWFuZCApIHtcbiAgICAgJC5leHRlbmQodHJ1ZSwgb3B0aW9ucywgbWFya2Vycy5ub0RlbWFuZCk7XG4gICAgIHJldHVybjtcbiAgfVxuXG4gIGlmKCByZW5kZXJEZW1hbmQgPT0gJ2ZpbGxlZCcgKSB7XG5cbiAgICBpZiggcGVyY2VudCA8PSAwICkge1xuICAgICAgb3B0aW9ucy5maWxsQ29sb3IgPSAnIzMzMyc7XG4gICAgICBvcHRpb25zLmZpbGxPcGFjaXR5ID0gMC4zO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgbyA9IHBlcmNlbnQ7XG4gICAgICBpZiggbyA+IDEgKSBvID0gMTtcbiAgICAgIG9wdGlvbnMuZmlsbE9wYWNpdHkgPSBvO1xuICAgICAgb3B0aW9ucy5maWxsQ29sb3IgPSAnIzAwMDBmZic7XG4gICAgfVxuXG4gIH0gZWxzZSB7XG5cbiAgICBpZiggcGVyY2VudCA+PSAxICkge1xuICAgICAgb3B0aW9ucy5maWxsQ29sb3IgPSAnIzMzMyc7XG4gICAgICBvcHRpb25zLmZpbGxPcGFjaXR5ID0gLjM7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBvID0gMSAtIHBlcmNlbnQ7XG4gICAgICBpZiggbyA+IDEgKSBvID0gMTtcbiAgICAgIGlmKCBvIDwgMCApIG8gPSAwO1xuXG4gICAgICBvcHRpb25zLmZpbGxPcGFjaXR5ID0gbztcbiAgICAgIG9wdGlvbnMuZmlsbENvbG9yID0gJyNmZjAwMDAnO1xuICAgIH1cblxuICB9XG4gIC8vb3B0aW9ucy5maWxsQ29sb3IgPSAnIycrZ2V0Q29sb3IoYWxsb2NhdGlvbiAvIGRlbWFuZCk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cy5wZXJjZW50RGVtYW5kSHVjID0gZnVuY3Rpb24ocGVyY2VudCkge1xuICBpZiggcGVyY2VudCA9PSAtMSApIHtcbiAgICAgcmV0dXJuIHtcbiAgICAgICBmaWxsQ29sb3IgOiAnI2ZmZmZmZicsXG4gICAgICAgZmlsbE9wYWNpdHkgOiAuMixcbiAgICAgICB3ZWlnaHQgOiAxLFxuICAgICAgIGNvbG9yOiAnIzMzMzMzMydcbiAgICAgfVxuICB9XG5cblxuICBpZiggcmVuZGVyRGVtYW5kID09ICdmaWxsZWQnICkge1xuXG4gICAgaWYoIHBlcmNlbnQgPD0gMCApIHtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgZmlsbENvbG9yIDogJyMzMzMzMzMnLFxuICAgICAgICBmaWxsT3BhY2l0eSA6IDAuMyxcbiAgICAgICAgd2VpZ2h0IDogMixcbiAgICAgICAgY29sb3I6ICcjMzMzMzMzJ1xuICAgICAgfTtcblxuXG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBvID0gcGVyY2VudDtcbiAgICAgIGlmKCBvID4gMC44ICkgbyA9IDAuODtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgZmlsbENvbG9yIDogJyMwMDAwZmYnLFxuICAgICAgICBmaWxsT3BhY2l0eSA6IG8sXG4gICAgICAgIHdlaWdodCA6IDIsXG4gICAgICAgIGNvbG9yOiAnIzMzMzMzMydcbiAgICAgIH07XG4gICAgfVxuXG4gIH0gZWxzZSB7XG5cbiAgICBpZiggcGVyY2VudCA+PSAxICkge1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBmaWxsQ29sb3IgOiAnIzMzMzMzMycsXG4gICAgICAgIGZpbGxPcGFjaXR5IDogMC4zLFxuICAgICAgICB3ZWlnaHQgOiAyLFxuICAgICAgICBjb2xvcjogJyMzMzMzMzMnXG4gICAgICB9XG5cbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIG8gPSAxIC0gcGVyY2VudDtcbiAgICAgIGlmKCBvID4gMC44ICkgbyA9IDAuODtcbiAgICAgIGlmKCBvIDwgMCApIG8gPSAwO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBmaWxsQ29sb3IgOiAnI2ZmMDAwMCcsXG4gICAgICAgIGZpbGxPcGFjaXR5IDogbyxcbiAgICAgICAgd2VpZ2h0IDogMixcbiAgICAgICAgY29sb3I6ICcjMzMzMzMzJ1xuICAgICAgfTtcblxuICAgIH1cblxuICB9XG4gIC8vb3B0aW9ucy5maWxsQ29sb3IgPSAnIycrZ2V0Q29sb3IoYWxsb2NhdGlvbiAvIGRlbWFuZCk7XG59O1xuIiwidmFyIEljb25SZW5kZXJlciA9IHJlcXVpcmUoJy4vaWNvblJlbmRlcmVyJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oY29uZmlnKSB7XG4gIHRoaXMuY29uZmlnID0gY29uZmlnO1xuICB0aGlzLmVsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpO1xuXG4gIHRoaXMucmVkcmF3ID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHcgPSBjb25maWcuaGVpZ2h0IHx8IDMyO1xuICAgIHZhciBoID0gY29uZmlnLndpZHRoIHx8IDMyO1xuXG4gICAgdGhpcy5lbGUuaGVpZ2h0ID0gaDtcbiAgICB0aGlzLmVsZS53aWR0aCA9IHc7XG5cbiAgICB2YXIgY3R4ID0gdGhpcy5lbGUuZ2V0Q29udGV4dChcIjJkXCIpO1xuICAgIGN0eC5jbGVhclJlY3QoMCwgMCwgdywgaCk7XG5cbiAgICBJY29uUmVuZGVyZXIoY3R4LCBjb25maWcpO1xuICB9O1xuXG4gIHRoaXMucmVkcmF3KCk7XG59O1xuIiwidmFyIHV0aWwgPSByZXF1aXJlKCcuL3V0aWxzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oY3R4LCBjb25maWcpIHtcblxuICB2YXIgc2lkZXMgPSBjb25maWcuc2lkZXMgIT09IG51bGwgPyBjb25maWcuc2lkZXMgOiA2O1xuICB2YXIgcm90YXRlID0gY29uZmlnLnJvdGF0ZSA/IGNvbmZpZy5yb3RhdGUgOiAwO1xuICB2YXIgeCA9IGNvbmZpZy53aWR0aCAvIDI7XG4gIHZhciB5ID0gY29uZmlnLmhlaWdodCAvIDI7XG5cbiAgdmFyIGEgPSAoKE1hdGguUEkgKiAyKSAvIGNvbmZpZy5zaWRlcyk7XG4gIHZhciByID0gcm90YXRlICogKE1hdGguUEkgLyAxODApO1xuXG4gIHZhciByYWRpdXMgPSAoY29uZmlnLndpZHRoIC8gMikgLSAxO1xuXG4gIHZhciBmaWxsU3R5bGUgPSB1dGlsLmhleFRvUmdiKGNvbmZpZy5maWxsQ29sb3IpO1xuICBmaWxsU3R5bGUucHVzaChjb25maWcuZmlsbE9wYWNpdHkpO1xuICBjdHguZmlsbFN0eWxlID0gJ3JnYmEoJytmaWxsU3R5bGUuam9pbignLCcpKycpJztcblxuICBjdHguc3Ryb2tlU3R5bGUgPSBjb25maWcuY29sb3I7XG5cbiAgLy8gdGhpbmsgeW91IG5lZWQgdG8gYWRqdXN0IGJ5IHgsIHlcbiAgY3R4LmJlZ2luUGF0aCgpO1xuXG4gIC8vIGRyYXcgY2lyY2xlXG4gIGlmICggc2lkZXMgPCAzICkge1xuXG4gICAgY3R4LmFyYyh4LCB5LCByYWRpdXMsIDAsIDIqTWF0aC5QSSk7XG5cbiAgfSBlbHNlIHtcblxuICAgIHZhciB0eCwgdHksIGk7XG4gICAgZm9yIChpID0gMDsgaSA8IGNvbmZpZy5zaWRlczsgaSsrKSB7XG4gICAgICB0eCA9IHggKyAocmFkaXVzICogTWF0aC5jb3MoYSppLXIpKTtcbiAgICAgIHR5ID0geSArIChyYWRpdXMgKiBNYXRoLnNpbihhKmktcikpO1xuXG4gICAgICBpZiggaSA9PT0gMCApIGN0eC5tb3ZlVG8odHgsIHR5KTtcbiAgICAgIGVsc2UgY3R4LmxpbmVUbyh0eCwgdHkpO1xuICAgIH1cbiAgICBjdHgubGluZVRvKHggKyAocmFkaXVzICogTWF0aC5jb3MoLTEgKiByKSksIHkgKyAocmFkaXVzICogTWF0aC5zaW4oLTEgKiByKSkpO1xuICB9XG5cbiAgaWYoICFjb25maWcubm9GaWxsICkgY3R4LmZpbGwoKTtcbiAgY3R4LnN0cm9rZSgpO1xuXG4gIGlmKCBjb25maWcuc3RyaWtldGhyb3VnaCApIHtcbiAgICBjdHguYmVnaW5QYXRoKCk7XG4gICAgY3R4Lm1vdmVUbygxLDEpO1xuICAgIGN0eC5saW5lVG8oKHgqMikgLSAxLCAoeSoyKSAtIDEpO1xuICAgIGN0eC5zdHJva2UoKTtcbiAgfVxufVxuIiwibW9kdWxlLmV4cG9ydHMuaGV4VG9SZ2IgPSBmdW5jdGlvbihoZXgpIHtcbiAgICB2YXIgcmVzdWx0ID0gL14jPyhbYS1mXFxkXXsyfSkoW2EtZlxcZF17Mn0pKFthLWZcXGRdezJ9KSQvaS5leGVjKGhleCk7XG4gICAgcmV0dXJuIHJlc3VsdCA/IFtcbiAgICAgICAgcGFyc2VJbnQocmVzdWx0WzFdLCAxNiksXG4gICAgICAgIHBhcnNlSW50KHJlc3VsdFsyXSwgMTYpLFxuICAgICAgICBwYXJzZUludChyZXN1bHRbM10sIDE2KVxuICAgIF0gOiBbMCwwLDBdO1xufTtcblxubW9kdWxlLmV4cG9ydHMuZ2V0Q29sb3IgPSBmdW5jdGlvbihudW0pIHtcbiAgaWYoIG51bSA+IDEgKSBudW0gPSAxO1xuICBpZiggbnVtIDwgMCApIG51bSA9IDA7XG5cbiAgdmFyIHNwcmVhZCA9IE1hdGguZmxvb3IoNTEwKm51bSkgLSAyNTU7XG5cbiAgaWYoIHNwcmVhZCA8IDAgKSByZXR1cm4gXCJmZjAwXCIrdG9IZXgoMjU1K3NwcmVhZCk7XG4gIGVsc2UgaWYoIHNwcmVhZCA+IDAgKSByZXR1cm4gdG9IZXgoMjU1LXNwcmVhZCkrXCIwMGZmXCI7XG4gIGVsc2UgcmV0dXJuIFwiZmZmZjAwXCI7XG59O1xuXG5tb2R1bGUuZXhwb3J0cy50b0hleCA9IGZ1bmN0aW9uKG51bSkge1xuICBudW0gPSBudW0udG9TdHJpbmcoMTYpO1xuICBpZiggbnVtLmxlbmd0aCA9PSAxICkgbnVtID0gXCIwXCIrbnVtO1xuICByZXR1cm4gbnVtO1xufTtcbiJdfQ==

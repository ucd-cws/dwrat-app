var map, geoJsonLayer;

var wmsLayers = [];

$(document).on('ready', function(){
  resize();
  init();
});

$(window)
  .on('hashchange', onHashUpdate)
  .on('resize', resize);

var allData = [];

// should be filled or empty;
var renderDemand = 'empty';
var currentPoints = null;
var lastRespPoints = null;

var markerTemplate =
  '<div class="spacer"></div>'+
  '<h3>Water Right/Claim #: {{application_number}}</h3>'+
  '<div style="margin:15px">'+
    '<b>For:</b> {{date}}<br />'+
    '<b>Allocation:</b> {{allocation}} [Ac-ft/day]<br />'+
    '<b>Demand:</b> {{demand}} [Ac-ft/day]'+
    '<br /><b>Percent of Demand: </b>{{ratio}}%<br />'+
    '<div class="well well-sm" style="margin-top:5px">'+
    '{{water_right_type}}<br />'+
    '<b>Priority Date:</b> {{priority_date}}'+
    '</div>'+
  '</div>';


function init() {
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

  var baseMaps = {};
  var overlayMaps = {
    'Watersheds': wms1,
    'HUC 12': wms2
  };
  L.control.layers(baseMaps, overlayMaps, {position: 'bottomleft'}).addTo(map);

  // initialize huc.js module
  HUC.init(map);

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
    $('#wrapper').css('opacity',.3);
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

  initLegend();

}

function initLegend() {
	var demandSteps = [0, 1, 50, 100, 250];

  var options = $.extend(true, {}, markers.riparian.unallocated);
  options.sides = 0;
	var icon = new DroughtIcon(options);
	$('#legend-riparian').append($(icon.ele));


  var options = $.extend(true, {}, markers.application.unallocated);
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

		var options;


		if( demandSteps[i] == 0 ) {
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

	for( var i = 0; i < icons.length; i++ ) {
		$('#legend-demand-'+i).append($(icons[i].ele));
	}

  redrawPDemandLegend();

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
}

function redrawPDemandLegend() {
  var percentSteps = [0, 25, 50, 75, 100];

  var table = '<table style="text-align:center"><tr style="vertical-align: bottom">';
  var icons = [];
	for( var i = 0; i < percentSteps.length; i++ ) {
		table += '<td style="padding:8px"><div id="legend-precent-of-demand-'+i+'"></div><div>'+
					percentSteps[i]+'%</div></td>';

		var options = $.extend(true, {}, markers.application.unallocated);

    renderPercentDemand(options, percentSteps[i] / 100);

		icons.push(new DroughtIcon(options));
	}
	$('#legend-precent-of-demand').html(table+'</tr></table>');

	for( var i = 0; i < icons.length; i++ ) {
		$('#legend-precent-of-demand-'+i).append($(icons[i].ele));
	}
}


function processFile(e) {
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
}

/*
function initVizSource() {
  getWatersheds();
}*/

/*
function getWatersheds() {
  var query = new google.visualization.Query('http://watershed.ice.ucdavis.edu/vizsource/rest?view=watersheds&tq=SELECT * order by watershed');
    query.send(function(response){
      if (response.isError()) {
        $('#response').html('<div class="alert alert-danger">Error in query: ' + response.getMessage() + ' '
            + response.getDetailedMessage()+'</div>');
        return;
      }

      var data = response.getDataTable();
      var select = $('#watershed');
      for( var i = 0; i < data.getNumberOfRows(); i++ ) {
        if( data.getValue(i, 0) ) select.append('<option value="'+data.getValue(i, 0)+'" '+
          (data.getValue(i, 0) == 'EEL RIVER' ? 'selected' : '') + ' >'+
          data.getValue(i, 0)+'</option>');
      };

      $('#exec').removeClass('disabled').html('Execute');
      initMapQuery();
    });
}*/

function resize() {
  // why is this not working???
  //$('#map').height($(window).height())
  //     .width($(window).width());

  var h = window.innerHeight;
  var w = window.innerWidth;
  if( h == null ) h = $(window).height();
  if( w == null ) w = $(window).width();

  $('#map').height(h).width(w);
  $('#info').css('max-height', (h-85)+'px');
}
/*
function initMapQuery() {
  var date = new Date().toISOString().split('T')[0];

  var params = getHashParams()
  $('#date').val(params.date || date).on('change', function(){
    updateHash();
    //query();
  });
  $('#search').on('keypress', function(e){
    if( e.which == 13 ) query();
  });

  var select = $('#watershed').on('change', function(e){
    updateHash();
    //query();
  });
  if( params.river ) select.val(params.river);


  if( params.zoom && !params.ll ) {
    try {
      map.setZoom(parseInt(params.zoom));
    } catch(e) {}
  }
  if ( params.ll  ) {
    try {
      var ll = params.ll.split(',');
      ll = [parseFloat(ll[0]), parseFloat(ll[1])];
      map.setView(ll, parseInt(params.zoom));
    } catch(e) {}
  }

  if( !params.ll && !params.zoom ) {
    map.setView([38, -116], 6);
  }

  setTimeout(function(){
    map.on('zoomend', updateHash);
    map.on('moveend', updateHash);
  },1000);

  query();
}*/

function updateHash() {
  var ll = map.getCenter();
  window.location.hash="date="+$('#date').val()+"&river="+encodeURIComponent($('#watershed').val())+
    '&zoom='+map.getZoom()+'&ll='+encodeURIComponent(ll.lat+','+ll.lng);
}

function getHashParams() {
  var params = {}; parts = window.location.hash.replace(/#/g,'').split('&');
  for( var i = 0; i < parts.length; i++ ) {
    var p = parts[i].split('=');
    params[p[0]] = decodeURIComponent(p[1]);
  }
  return params;
}

function onHashUpdate() {
  params = getHashParams();
  if( params.date ) {
    $('#date').val(params.date);
  }
  if( params.river ) {
    $('#watershed').val(params.river);
  }

  if( params.zoom ) {
    try {
      map.setZoom(parseInt(params.zoom));
    } catch(e) {}
  }
  if ( params.ll ) {
    try {
      var ll = params.ll.split(',');
      map.setView(L.latLng(parseFloat(ll[0]), parseFloat(ll[1])));
    } catch(e) {}
  }
  query();
}

var lastDate = '';
var lastRiver = '';
/*
function query() {
  if( $('#date').val() == lastDate && $('#watershed').val() == lastRiver ) return;
  lastDate = $('#date').val();
  lastRiver = $('#watershed').val();

  $('#loading').show();
  if( geoJsonLayer ) map.removeLayer(geoJsonLayer);
    geoJsonLayer = null;
    allData = [];

  //var query = new google.visualization.Query('http://watershed.ice.ucdavis.edu/vizsource/rest?view=demand(\'2014-03-01\')&tq=SELECT * limit 10');
    var query = new google.visualization.Query('http://watershed.ice.ucdavis.edu/vizsource/rest?view=allocation(\''+
      $('#date').val()+'\',\''+$('#watershed').val()+'\')&tq=SELECT *');
    query.send(onDataLoad);
}*/

/*
function onDataLoad(response) {
  if (response.isError()) {
      console.log('Error in query: ' + response.getMessage() + ' ' + response.getDetailedMessage());
      $('#loading').hide();
      return;
    }

    var data = response.getDataTable();

    // create table
    //var table = new google.visualization.Table(document.getElementById('table'));
    //table.draw(data, {});

    var columnMap = [];
    for( var i = 0; i < data.getNumberOfColumns(); i++ ) {
      columnMap.push(data.getColumnLabel(i));
    }

    var points = [];
    for( var i = 0; i < data.getNumberOfRows(); i++ ) {
      for( var j = 0; j < data.getNumberOfColumns(); j++ ) {

          if( columnMap[j] == 'geojson' ) {
            var p = JSON.parse(data.getValue(i, j));

            if( p.properties.allocations[0].season ) {
              points.push(p);

              var demand = p.properties.allocations[0].demand;
              var allocation = p.properties.allocations[0].allocation;
              if( demand > 0 ) {
                var ratio = allocation / demand;
                p.properties.allocations[0].ratio = ratio;
              }
          }
        }
      }
    };


    if( points.length == 0 ) {
      if( geoJsonLayer ) map.removeLayer(geoJsonLayer);
      $('#loading').hide();
      return;
    }

    points.sort(function(a, b){
      // TODO
    });

    addGeoJson(points);
    lastRespPoints = points;

  $('#loading').hide();
}*/

function addGeoJson(points) {
  var showNoDemand = $('#showNoDemand').is(':checked');

  if( !showNoDemand ) {
    tmp = [];
    for( var i = points.length-1; i >= 0; i-- ) {
      if( points[i].properties.allocations && points[i].properties.allocations.length > 0 ) {

        var demand = points[i].properties.allocations[0].demand;
        if( demand != 0 ) tmp.push(points[i]);
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

        if( demand == 0 ) {

          $.extend(true, options, markers.noDemand);
          feature.properties.noDemand = true;

        } else {
          renderPercentDemand(options, allocation / demand);

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
          ratio : p.allocations[0].ratio != null ? (p.allocations[0].ratio*100).toFixed(2) : '100',
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

  HUC.render(points);
}


function getColor(num) {
    if( num > 1 ) num = 1;
    if( num < 0 ) num = 0;

    var spread = Math.floor(510*num) - 255;

    if( spread < 0 ) return "ff00"+toHex(255+spread);
    else if( spread > 0 ) return toHex(255-spread)+"00ff";
    else return "ffff00";

}

function toHex(num) {
        num = num.toString(16);
        if( num.length == 1 ) num = "0"+num;
        return num;
}

var selected = null;
function select(marker) {
  if( selected != null ) {
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
    })
    if( marker.redraw ) marker.redraw();
  }

  selected = marker;
}


function stamp(data) {
  var template = markerTemplate;
  for( var key in data ) template = template.replace('{{'+key+'}}', data[key]);
  return template;
}

function onRenderTypeChange() {
  var isFilledChecked = $('#renderTypeFilled').is(':checked');
  var newVal = isFilledChecked ? 'filled' : 'empty';

  if( renderDemand == newVal ) return;
  renderDemand = newVal;

  // render legend
  redrawPDemandLegend();

  if( !currentPoints ) return;

  if( geoJsonLayer ) {
    map.removeLayer(geoJsonLayer);
    geoJsonLayer = null;
    allData = [];
  }
  addGeoJson(currentPoints);
}

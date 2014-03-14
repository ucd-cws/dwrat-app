var map;


$(window).on('ready', function(){
	resize();
	init();
});

$(window).on('resize', function(e){
	resize();
});

var allData = [];

var markerTemplate = 
	'<div class="spacer"></div>'+
	'<h3>Water Right #: {{application_number}}</h3>'+
	'<div style="margin:15px">'+
		'<b>For:</b> {{date}}<br />'+
		'<b>Allocation:</b> {{allocation}} [Ac-ft/day]'+
		'<div class="well well-sm" style="margin-top:5px">'+
		'{{water_right_type}}<br />'+
		'<b>Priority Date:</b> {{priority_date}}'+
		'</div>'+
	'</div>'
	

var markers = {
	riparian : {
		allocated : {
	    	radius      : 9,
	    	fillColor   : "#2525C9",
	    	color       : "#333",
	    	weight      : 1,
	    	opacity     : 1,
	    	fillOpacity : .8,
	    	sides       : 4,
			rotate      : 45
		},
		unallocated : {
			radius      : 9,
	    	fillColor   : "#fff",
	    	color       : "#333",
	    	weight      : 1,
	    	opacity     : 1,
	    	fillOpacity : .3,
	    	sides       : 4,
			rotate      : 45
		}
	},
	application : {
		allocated : {
	    	radius      : 9,
	    	fillColor   : "#2525C9",
	    	color       : "#333",
	    	weight      : 1,
	    	opacity     : 1,
	    	fillOpacity : .8
		},
		unallocated : {
			radius      : 9,
	    	fillColor   : "#fff",
	    	color       : "#333",
	    	weight      : 1,
	    	opacity     : 1,
	    	fillOpacity : .3
		}
	}
}


function init() {
	map = L.map('map',{trackResize:true}).setView([38, -116], 6);

	// add an OpenStreetMap tile layer
	L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
	    attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
	}).addTo(map);


	$('#close-popup').on('click', function(){
		$('#info').removeClass('fadeInDown').addClass('slideOutRight');
		select(null);
		setTimeout(function(){
			$('#info').hide().addClass('fadeInDown').removeClass('slideOutRight');
		}, 800);
		
	});
}

function resize() {
	// why is this not working???
	//$('#map').height($(window).height())
	//		 .width($(window).width());

	var h = window.innerHeight;
	var w = window.innerWidth;
	if( h == null ) h = $(window).height();
	if( w == null ) w = $(window).width();

	$('#map').height(h).width(w);
	$('#info').css('max-height', (h-85)+'px');
}

function drawChart() {
	$('#date').val('2014-03-01').on('change', function(){
		alert('not implemented yet');
	});

	$('#search').on('keypress', function(e){
		if( e.which == 13 ) alert('not implemented yet');
	});
	//var query = new google.visualization.Query('http://watershed.ice.ucdavis.edu/vizsource/rest?view=demand(\'2014-03-01\')&tq=SELECT * limit 10');
  	var query = new google.visualization.Query('http://watershed.ice.ucdavis.edu/vizsource/rest?view=allocation(\'2014-03-01\')&tq=SELECT *');

  	query.send(onDataLoad);
}

function onDataLoad(response) {
	if (response.isError()) {
      console.log('Error in query: ' + response.getMessage() + ' ' + response.getDetailedMessage());
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
	        if( columnMap[j] == 'geojson' ) points.push(JSON.parse(data.getValue(i, j)));
	    }
    };

    console.log(points.length);

    var l = L.geoJson(points,{
		pointToLayer: function (feature, latlng) {
			var type = feature.properties.riparian ? 'riparian' : 'application';
			var allocation = 'unallocated';

			for( var i = 0; i < feature.properties.allocations.length; i++ ) {
				if( feature.properties.allocations[i].allocation > 0 ) allocation = 'allocated';
			}

			var marker;
			if( feature.properties.riparian ) {
				marker = L.polyMarker(latlng, markers[type][allocation]);
			} else {
				marker = L.circleMarker(latlng, markers[type][allocation]);
			}

			allData.push({
				feature : feature,
				marker  : marker 
			});
			return marker;
	    }
	}).addTo(map);

	l.on('click', function(e) {
		$('.select-text').remove();
		$('#info').show();
		var props = e.layer.feature.properties;

		select(e.layer);

		/*for( var i = 0; i < allData.length; i++ ) {
			if( allData[i].feature.properties.application_number == props.application_number ) {
				select(allData[i].marker);
				break;
			}
		}*/

		
		$('#info-result').html(stamp({
			application_number : props.application_number,
			date : '2014-03-01',
			allocation : props.allocations[0].allocation,
			water_right_type : props.water_right_type,
			priority_date : props.priority_date
		}));
	});
}

var selected = null;
function select(marker) {
	if( selected != null ) {
		selected.setStyle({
			color : '#333',
			weight : 1
		});
		selected.redraw();
	}

	if( marker ) {
		marker.setStyle({
			color : '#ff0000',
			weight : 2
		})
		marker.redraw();
	}
	
	selected = marker;
}


function stamp(data) {
	var template = markerTemplate;
	for( var key in data ) template = template.replace('{{'+key+'}}', data[key]);
	return template;
}

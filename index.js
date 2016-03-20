require('mapbox.js');
L.mapbox.accessToken = 'pk.eyJ1IjoicHJhdGlreWFkYXYiLCJhIjoiMTA2YWUxNjRkNmFmZGQ4YzAxZWFiNDk0NDM1YjE1YjAifQ.4P6N5dNmA_WQXd3BsJvu5w';
var geocoder = L.mapbox.geocoder('mapbox.places');

var Raven = require('raven-js');
var d3 = require('d3');
require('./js/keybinding.js');

// Sentry reporting
//Raven.config('https://24ed0428f5e848a9a804b1d03670ae8e@app.getsentry.com/38240', {
//  whitelistUrls: ['mapbox.com']
//}).install();

// Restrict panning to one copy of the world
var southWest = L.latLng(-90, -180),
    northEast = L.latLng(90, 180),
    bounds = L.latLngBounds(southWest, northEast);

// Extract any coordinates from the URL
var hash = document.location.hash ? document.location.hash.split('#') : [];
var parts = (hash.length) ? hash[1].split('/') : [];

parts = {
  lng: !isNaN(parts[0] && parts[0]) ? parseFloat(parts[0]).toFixed(6) : -0,
  lat: !isNaN(parts[1] && parts[1]) ? parseFloat(parts[1]).toFixed(6) : 21,
  zoom: !isNaN(parts[2] && parts[2]) ? parts[2] : 2,
};

// HTML Components
var scrubber    = d3.select('#scrubber');
var tooltip     = d3.select('.js-range-tooltip');
var play        = d3.select('.js-play');
var labelText   = d3.select('.js-label');
var labelStats  = d3.select('.js-stats');

// Variables for populating graphs
var margin, width, height, x, y, stats;

// Map initialization
var map = L.mapbox.map('map', 'tristen.5467621e', {
  zoomControl: false,
  attributionControl: false,
  noWrap: true,
  minZoom: 2,
  maxBounds: bounds
}).setView([parts.lat, parts.lng], parts.zoom);

// Base layer
// L.mapbox.tileLayer('tristen.5467621e', { noWrap:true }).addTo(map);

function reviseHash() {
  var url = parts.lng + '/' + parts.lat + '/' + parts.zoom;
  window.location.hash = url;
}

function findLocation() {
  if (map.getZoom() > 3) {
    geocoder.reverseQuery([parseFloat(parts.lng), parseFloat(parts.lat)], function(err, res) {
      if (res && res.features && res.features[0]) {
        labelText.text(res.features[0].place_name);
      }
    });
  }
}

var locatePlace;
map.on('locationfound', function(e) {
  map.fitBounds(e.bounds);
  map.setZoom(16);
  d3.select('.leaflet-geolocate').classed('loading', false);
}).on('movestart', function() {
  if (locatePlace) window.clearTimeout(locatePlace);
}).on('moveend', function() {
  var center = map.getCenter();
  parts.lat = center.lat.toFixed(6);
  parts.lng = center.lng.toFixed(6);
  parts.zoom = map.getZoom();
  reviseHash();

  // Display label stats?
  labelStats.classed('active', (stats && map.getZoom() <= 3));
  if (map.getZoom() <= 3) labelText.text('');

  // Geolocate if timeout hasnt cleared after 3s.
  locatePlace = window.setTimeout(findLocation, 3000);
});

map.scrollWheelZoom.disable();
new L.Control.Zoom({ position: 'topright' }).addTo(map);

var layers = [
  { title: '2006', fill: '#0000ff', layer: 'pratikyadav.ea6f58c9', },
  { title: '2007', fill: '#4400CC', layer: 'pratikyadav.ea6f58c9', },
  { title: '2008', fill: '#880088', layer: 'pratikyadav.ea6f58c9', },
  { title: '2009', fill: '#CC0044', layer: 'pratikyadav.ea6f58c9', },
  { title: '2010', fill: '#ff0000', layer: 'pratikyadav.3ddb6cb6', },
  { title: '2011', fill: '#ff4400', layer: 'pratikyadav.ef1d8412', },
  { title: '2012', fill: '#ff8800', layer: 'pratikyadav.5cfaeba9', },
  { title: '2013', fill: '#ffCC00', layer: 'pratikyadav.b24a1936', },
  { title: '2014', fill: '#ffff00', layer: 'pratikyadav.375fb83c', },
  { title: '2015', fill: '#ffff00', layer: 'pratikyadav.51cf69c5'  }
].map(function(l, i) {
  l.layer = L.mapbox.tileLayer(l.layer, {noWrap:true}).addTo(map);
  return l;
});

var tally = 0; // The current index in the layers array we are showing.
function rangeControl(el) {
  // Adjust the position of the range
  // input tooltip to follow the thumbtrack.
  var width = el.clientWidth;
  var max = el.getAttribute('max');
  var posPerc = (el.value / max) * 100;
  var pixPos = (posPerc / 100) * width;
  pixPos += el.offsetLeft;

  var bounds = el.getBoundingClientRect();

  // If the tooltip's right position
  // equals the right position of the range slider
  if ((pixPos + 6) > width) {
    tooltip.style({'left': 'auto', 'right': 0 });
  } else {
    tooltip.style({'right': 'auto', 'left': pixPos+'px' });
  }

  // Find the current index
  var index = Math.floor(el.value / 100);
      index = (layers[index]) ? index : layers.length - 1;

  // Opacity should be the decimal place of el.value/100
  var opacity = (el.value/100 % 1).toFixed(2);
  if (el.value === max) opacity = '100';

  // Update graph marker on sparklines
  if (stats) {
    d3.selectAll('.statistic')
      .each(function(d) {
        var pos = Math.ceil(el.value / (layers.length * 100) * d.data.length);
        d3.select(this)
          .text(function() {
            var suffix = (d.suffix) ? d.suffix : '';
            var value = (d.data[pos]) ?
              d.data[pos].value : d.data[d.data.length -1].value;

            return d.label + ': ' + d3.format(',')(value) + suffix;
          });
      });
  }

  if (index !== tally) {
    // When the index updates, make sure layer before the
    // current are set to full opacity and future ones are at 0.
    layers.forEach(function(l, i) {
      if (i > index) l.layer.getContainer().style.opacity = 0;
      if (i < index) l.layer.getContainer().style.opacity = 1;
    });

    // Update tooltip contents
    tooltip.select('.dot')
      .style('background', layers[index].fill);
    tooltip.select('label')
      .text(layers[index].title);
  }

  layers[index].layer.getContainer().style.opacity = opacity;
  tally = index;
}

var playback;
function setPlayback() {
  if (playback) window.clearInterval(playback);
  var r = range.node();
  play.classed('playback', false).classed('pause', true);
  playback = window.setInterval(function() {
    r.value++;
    if (r.value === r.getAttribute('max')) r.value = 0;
    rangeControl(r);
  }, 10);
}

var range = scrubber.append('input')
  .attr('class', 'col12')
  .attr('type', 'range')
  .attr('min', 0)
  .attr('step', 1)
  .attr('max', layers.length * 100)
  .attr('value', layers.length * 100)
  .on('input', function() { rangeControl(this); })
  .on('mousedown', function() {
    // If playback is enabled, stop it.
    // the user wants to scrub using the range slider.
    if (playback) {
      window.clearInterval(playback);
      play.classed('pause', false).classed('playback', true);
    }
  });

// Location navigation
play.on('click', function() {
  d3.event.preventDefault();
  d3.event.stopPropagation();
  var el = d3.select(this);
  if (el.classed('playback')) {
    setPlayback();
  } else {
    if (playback) window.clearInterval(playback);
    el.classed('pause', false).classed('playback', true);
  }
});

var locations = [{
  title: 'London, UK',
  coords: [51.5075, -0.1306, 13]
}, {
  title: 'Paris, France',
  coords: [48.8539, 2.3497, 13]
}, {
  title: 'Chicago, USA',
  coords: [41.8802, -87.6374, 13]
}, {
  title: 'Melbourne, Australia',
  coords: [-37.8307, 144.9086, 12]
}, {
  title: 'Japan',
  coords: [36.0891, 136.0822, 7]
}, {
  title: 'Switzerland',
  coords: [47.5151, 7.7343, 10]
}, {
  title: 'Los Angeles',
  coords: [33.9829, -117.8860, 11]
}, {
  title: 'Ayacucho, Peru',
  coords: [50.8398, 4.3274, 12]
}, {
  title: 'Berlin, Germany',
  coords: [52.5121, 13.3865, 13]
}, {
  title: 'Barcelona, Spain',
  coords: [41.3842, 2.1564, 13]
}, {
  title: 'Washington DC, USA',
  coords: [38.9011, -77.0406, 13]
}, {
  title: 'Sochi, Russia',
  coords: [43.5859, 39.7235, 14]
}];

var locationIndex = 0;
d3.select('.js-next').on('click', function() {
  d3.event.preventDefault();
  d3.event.stopPropagation();
  if (locationIndex === locations.length) locationIndex = 0;

  var location = locations[locationIndex];
  var coords = location.coords;
  map.setView([coords[0], coords[1]], coords[2]);

  // Display for location name.
  labelText.text(location.title);

  locationIndex++;
  if (locatePlace) window.clearTimeout(locatePlace);

  range.node().value = 0;
  setPlayback();
});

function windowPopup(url) {
  // Calculate the position of the popup so
  // it’s centered on the screen.
  var width = 500;
  var height = 300;
  var left = (screen) ? (screen.width / 2) - (width / 2) : 20;
  var top = (screen) ? (screen.height / 2) - (height / 2) : 20;

  window.open(
    url,
    '',
    'menubar=no,toolbar=no,resizable=yes,scrollbars=yes,width=' + width + ',height=' + height + ',top=' + top + ',left=' + left
  );
}

// Social sharing links
d3.selectAll('.js-twitter').on('click', function() {
  d3.event.preventDefault();
  d3.event.stopPropagation();
  var href = this.href;
  var url = window.encodeURIComponent(window.location.href);
  var params = '?text=' + window.encodeURIComponent(document.title);
      params += '&url=' + url;
      params += '&via=mapbox';
      params += '&hashtags=OpenStreetMap, OSM';
  windowPopup(this.href + params);
});

d3.selectAll('.js-facebook').on('click', function() {
  d3.event.preventDefault();
  d3.event.stopPropagation();
  var href = this.href;
  var url = window.encodeURIComponent(window.location.href);
  var params = '?u=' + url;
  windowPopup(this.href + params);
});

// Social sharing links
d3.select('.js-explore').on('click', function() {
  d3.event.preventDefault();
  d3.event.stopPropagation();
  d3.select('body').classed('intro', false);
  range.node().value = 0;
  setPlayback();
});

// OSM link in top left corner
d3.select('.js-about').on('click', function() {
  d3.event.preventDefault();
  d3.event.stopPropagation();
  d3.select('body').classed('intro', true);
  map.setView([14, 39], 2);
  reset();
});

// play/pause control with the spacebar
d3.select('body').call(d3.keybinding()
  .on('space', function() {
    if (play.classed('playback') && !d3.select('body').classed('intro')) {
      setPlayback();
    } else {
      if (playback) window.clearInterval(playback);
      play.classed('playback', true).classed('pause', false);
    }
  })
);

var graphData = [
  { 'label': 'Registered users', 'source': 'highest-uid.csv' },
  { 'label': 'Active users/month', 'source': 'active-ever.csv' },
  { 'label': 'Buildings', 'source': 'total-buildings.csv' },
  { 'label': 'Major roads', 'source': 'major-roads.csv', 'suffix': ' miles' }
], done = 0;

function gatherData(arr, cb) {
  if (done === arr.length) return cb(arr);
  d3.csv('data/' + arr[done].source, function(err, res) {
    if (err) return console.error(err);
    arr[done].data = res;
    done++;
    return gatherData(arr, cb);
  });
}

function reset() {
  // Initial layer to display
  var target = layers[layers.length - 1];

  // Cancel playback if it is running
  if (playback) window.clearInterval(playback);

  // Set tooltip as the first layer
  tooltip.select('label').text(target.title);
  tooltip.select('.dot').style('background', target.fill);

  // Bring all layer opacity up and call rangeControl
  layers.forEach(function(l) { l.layer.getContainer().style.opacity = 1; });
  rangeControl(range.node());
  labelText.html('&nbsp;');
}

// Initialization
(function() {
  if (hash) findLocation();
  reset();

  // Geolocate
  d3.select('.leaflet-right').append('div')
    .attr('class', 'leaflet-control leaflet-bar')
    .append('a')
      .attr('class', 'icon geolocate dark leaflet-geolocate animate')
      .attr('title', 'Geolocate your location')
      .attr('href', '#')
      .on('click', function() {
        d3.event.preventDefault();
        d3.event.stopPropagation();
        d3.select(this).classed('loading', true);
        map.locate();
      });

  gatherData(graphData, function(data) {
    if (!data || !data.length) return;
    stats = true;

    var overviews = labelStats
      .classed('active', (map.getZoom() <= 3))
      .selectAll('div')
      .data(data);

    var overview = overviews.enter()
      .append('div')
      .attr('class', 'inline');

    var parseDate = d3.time.format('%Y-%m').parse;
    overview.each(function(d) {
      // Format d.data for sparklines. Also,
      // parse date field as JavaScript date.
      d.data = d.data.map(function(v) {
        v.date = parseDate(v.date);
        v.value = +v.value;
        return v;
      });

      var last = d.data[d.data.length - 1];
      d3.select(this).append('strong')
        .attr('class', 'col12 center text-shadow statistic')
        .text(function() {
          var suffix = (d.suffix) ? d.suffix : '';
          return d.label + ': ' + d3.format(',')(last.value) + suffix;
      });
    });
  });

})();

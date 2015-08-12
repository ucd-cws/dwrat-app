var IconRenderer = require('../markers/iconRenderer');

L.Icon.Canvas = L.Icon.extend({
    options: {
        iconSize: new L.Point(20, 20), // Have to be supplied
        className: 'leaflet-canvas-icon'
    },

    createIcon: function () {
        var e = document.createElement('canvas');
        this._setIconStyles(e, 'icon');

        e.width = this.options.width;
        e.height = this.options.height;

        e.style.marginTop = (-1*this.options.width/2)+'px';
        e.style.marginLeft = (-1*this.options.height/2)+'px';

        e.style.width = this.options.width+'px';
        e.style.height =this.options.height+'px';

        this.draw(e.getContext('2d'));

        return e;
    },

    createShadow: function () {
        return null;
    },


    draw: function(ctx) {
      IconRenderer(ctx, this.options);
    }
});

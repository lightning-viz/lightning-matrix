'use strict';
var d3 = require('d3');
var _ = require('lodash');
var utils = require('lightning-client-utils');
var colorbrewer = require('colorbrewer');
var LightningVisualization = require('lightning-visualization');
var fs = require('fs');
var css = fs.readFileSync(__dirname + '/style.css');

var Visualization = LightningVisualization.extend({

    getDefaultStyles: function() {
        return {
            colormap: 'Purples'
        }
    },

    getDefaultOptions: function() {
        return {
            labels: true
        }
    },

    init: function() {
        this.margin = {left: 0, top: 0};
        if (this.data.rows) {
            this.margin.left = 80;
        }
        if (this.data.columns) {
            this.margin.top = 80;
        }
        this.render();
    },

    css: css,

    render: function() {
        var width = this.width;
        var height = this.height;
        var margin = this.margin;
        var data = this.data;
        var options = this.options;
        var selector = this.selector;
        var self = this;

        var nrow = data.nrow;
        var ncol = data.ncol;

        // automatically scale stroke width by number of cells
        var strokeWidth = Math.max(1 - 0.00009 * nrow * ncol, 0.1);

        // make a scale for fill coloring
        var name = data.colormap ? data.colormap : self.defaultColormap;
        this.makeScales(name);

        // create container
        var container = d3.select(selector)
            .append('div')
            .style('width', width)
            .style('height', height)
            .style('position', 'relative');

        // create svg
        var svg = container
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .style('position', 'absolute')
            .on('dblclick', reset);

        // automatically determine cell size to fill the grid
        var size;
        if (ncol > nrow) {
            size = Math.min((height - margin.top) / nrow, (width - margin.left) / ncol)
        } else {
            size = (height - margin.top) / nrow
        }
        this.y = d3.scale.ordinal().rangeBands([0, (nrow * size)]).domain(d3.range(nrow));
        this.x = d3.scale.ordinal().rangeBands([0, (ncol * size)]).domain(d3.range(ncol));

        // sort rows (currently unusused)
        this.sortRows('');

        // adjust height and weight for canvas based on estimated size
        height = nrow * self.y.rangeBand();
        width = ncol * self.x.rangeBand();

        // set up variables to toggle with keypresses
        var clist = ['Purples', 'Blues', 'Greens', 'Oranges', 'Reds', 'Greys'];
        var cindex = 0;
        var scale = 0;

        // create canvas
        var canvas = container
            .append('canvas')
            .attr('width', width)
            .attr('height', height)
            .attr('id', 'canvas1')
            .style('margin-left', margin.left + 'px')
            .style('margin-top', margin.top + 'px');

        var ctx = canvas
            .node().getContext("2d");

        // add keydown events
        d3.select(selector).attr('tabindex', -1);
        d3.select(selector).on('keydown', update);

        // compute good font sizes for axis and cell labels
        var axisfont = Math.min((size * 72 / 96) / 2, 14);
        axisfont = Math.max(axisfont, 8);
        var cellfont = (size * 72 / 96) / 2.5;

        // draw the axis labels
        if (data.columns) {
            svg.selectAll('.column-label')
                .data(data.columns)
                .enter()
                .append("text")
                .attr("text-anchor", "start")
                .attr("transform", function(d, i) {
                    return "translate(" + (margin.left + self.x(i) + self.x.rangeBand() / 2) +
                        "," +  margin.top * 0.9 + ")rotate(-50)"
                })
                .attr("class", "axis-label column-label")
                .style("font-size", axisfont + "px")
                .text(function(d) {return d})
                .on('mouseover', highlight)
                .on('mouseout', unhighlight)
                .on('click', select)
        }
        if (data.rows) {
            svg.selectAll('.row-label')
                .data(data.rows)
                .enter()
                .append("text")
                .attr("text-anchor", "end")
                .attr("x", margin.left * 0.9)
                .attr("y", function(d, i) {return margin.top + self.y(i) + self.y.rangeBand() / 2})
                .attr("dy","0.35em")
                .attr("class", "axis-label row-label")
                .style("font-size", axisfont + "px")
                .text(function(d) {return d})
                .on('mouseover', highlight)
                .on('mouseout', unhighlight)
                .on('click', select)
        }

        // begin with nothing selected
        var selectedx = [];
        var selectedy = [];

        // highlight row or column
        function highlight() {
            d3.select(this).classed('selected', true)
        }

        // unhighlight row or column
        function unhighlight() {
            d3.select(this).classed('selected', false)
        }

        // select row or column
        function select() {
            var el = d3.select(this);
            var thislabel = el.node().__data__;
            var indx = _.indexOf(data.columns, thislabel);
            var indy = _.indexOf(data.rows, thislabel);
            if (indx > -1) {
                selectedx = getselected(selectedx, indx)
            }
            if (indy > -1) {
                selectedy = getselected(selectedy, indy)
            }
            draw()
        }

        // get selected elements given current list
        function getselected(current, target) {
            if (_.indexOf(current, target) > -1) {
                return []
            } else {
                return [target]
            }
        }

        // reset selections
        function reset() {
            selectedx = [];
            selectedy = [];
            draw()
        }

        // draw the matrix
        function draw() {

            d3.selectAll('.row-label').classed('selected-sticky', function(d) {
                if (selectedy.length > 0) {
                    return (_.indexOf(data.rows, d) == selectedy)
                } else {
                    return false
                }
            });

            d3.selectAll('.column-label').classed('selected-sticky', function(d) {
                if (selectedx.length > 0) {
                    return (_.indexOf(data.columns, d) == selectedx)
                } else {
                    return false
                }
            });

          // clear canvas
          ctx.clearRect(0, 0, width, height);
          
          _.forEach(data.entries, function(d) {

            var opacity;
            if (selectedx.length > 0 || selectedy.length > 0) {
                if (selectedx.length > 0 && _.indexOf(selectedx, d.x) > -1) {
                    opacity = 1.0
                } else if (selectedy.length > 0 && _.indexOf(selectedy, d.y) > -1) {
                    opacity = 1.0
                } else {
                    opacity = 0.2
                }
            } else {
                opacity = 1.0
            }

            var fill = self.getColor(d, opacity);

            ctx.beginPath();
            ctx.fillStyle = fill;
            ctx.strokeStyle = 'white';
            ctx.lineWidth = strokeWidth;
            ctx.rect(self.x(d.x), self.y(d.y), self.x.rangeBand(), self.y.rangeBand());
            ctx.fill();
            ctx.stroke();
            ctx.closePath();

            // draw text labels
            if (options.labels) {
                var str = self.formatLabel(d.z);
                ctx.font = cellfont + "px monospace";
                if (d.z <= self.data.zmin + (self.data.zmax - self.data.zmin) / 2) {
                    if (opacity < 1.0) {
                        ctx.fillStyle = utils.buildRGBA('black', opacity / 5);
                    } else {
                        ctx.fillStyle = utils.buildRGBA('black', opacity);
                    }
                } else {
                    ctx.fillStyle = utils.buildRGBA('white', opacity);
                }
                ctx.textBaseline = 'middle'; 
                ctx.textAlign = 'center'; 
                ctx.fillText(str, self.x(d.x) + self.x.rangeBand() / 2,
                    self.y(d.y) + self.y.rangeBand() / 2);
            }

          })
        }

        // update event for keypresses
        function update() {
            if (d3.event.keyCode == 38 || d3.event.keyCode == 40) {
                d3.event.preventDefault();
                if (d3.event.keyCode == 38) {
                    scale = scale + 0.05;
                    if (scale > 0.4) {
                        scale = 0.4;
                        return
                    }
                }
                if (d3.event.keyCode == 40) {
                    scale = scale - 0.05;
                    if (scale < -2) {
                        scale = -2;
                        return
                    }
                }
                var extent = self.data.zmax - self.data.zmin;
                var domain = utils.linspace(self.data.zmin + extent * scale,
                    self.data.zmax - extent * scale, 9);
                self.updateDomain(domain);
                draw();
            }
            if (d3.event.keyCode == 37 || d3.event.keyCode == 39) {
                d3.event.preventDefault();
                if (d3.event.keyCode == 37) {
                    cindex = cindex - 1;
                    if (cindex < 0) {
                        cindex = clist.length - 1
                    }
                }
                if (d3.event.keyCode == 39) {
                    cindex = cindex + 1;
                    if (cindex > clist.length - 1) {
                        cindex = 0
                    }
                }
                self.updateRange(clist[cindex]);
                draw();
            }
        }

        draw();

    },

    sortRows: function(method) {},

    makeScales: function(d) {
        this.c = d3.scale.linear();
        this.c.domain(utils.linspace(this.data.zmin, this.data.zmax, 9));
        this.c.range(colorbrewer[d][9])
    },

    updateRange: function(d) {
        this.c.range(colorbrewer[d][9])
    },

    updateDomain: function(d) {
        this.c.domain(d)
    },

    getColor: function(d, opacity) {
        return utils.buildRGBA(this.c(d.z), opacity)
    },

    formatLabel: function(v) {
        return parseFloat(d3.format(".2f")(v)).toString();
    },

    formatData: function(data) {
        var entries = [];
        _.each(data.matrix, function(d, i) {
            _.each(d, function(e, j) {
                var p = {};
                p.x = j;
                p.y = i;
                p.z = e;
                if (data.rows) {
                    p.r = data.rows[i]
                }
                if (data.columns) {
                    p.c = data.columns[j]
                }
                entries.push(p)
            })
        });

        // get bounds on dimensions
        var nrow = data.matrix.length;
        var ncol = data.matrix[0].length;
        var zmin = d3.min(entries, function(d) {
            return d.z
        });
        var zmax = d3.max(entries, function(d) {
            return d.z
        });

        return {entries: entries, nrow: nrow, ncol: ncol, colormap: data.colormap,
                rows: data.rows, columns: data.columns, zmin: zmin, zmax: zmax}
    },

    updateData: function(formattedData) {
        this.data = formattedData;
        this.draw()
    }

});


module.exports = Visualization;

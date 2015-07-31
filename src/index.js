'use strict';

var d3 = require('d3');
var _ = require('lodash');
var utils = require('lightning-client-utils')
var colorbrewer = require('colorbrewer')
var LightningVisualization = require('lightning-visualization');

var fs = require('fs');
var styles = fs.readFileSync(__dirname + '/style.css');

/*
 * Extend the base visualization object
 */
var Visualization = LightningVisualization.extend({

    defaultColormap: 'Purples',

    init: function() {
        this.margin = {left: 0, top: 0};
        if (this.data.rows) {
            this.margin.left = 120;
        }
        if (this.data.columns) {
            this.margin.top = 120;
        }
        this.render();
    },

    styles: styles,

    render: function() {
        var width = this.width
        var height = this.height
        var margin = this.margin
        var data = this.data
        var selector = this.selector
        var self = this

        var entries = data.entries;
        var nrow = data.nrow
        var ncol = data.ncol

        // automatically scale stroke width by number of cells
        var strokeWidth = Math.max(1 - 0.00009 * nrow * ncol, 0.1);

        // get min and max of matrix value data
        var zmin = d3.min(entries, function(d) {
            return d.z
        });
        var zmax = d3.max(entries, function(d) {
            return d.z
        });

        // create colormap
        function colormap(name) {
            return colorbrewer[name][9]
        }

        // set up colormap
        var name = data.colormap ? data.colormap : self.defaultColormap
        var color = colormap(name)
        var zdomain = utils.linspace(zmin, zmax, 9)
        var z = d3.scale.linear().domain(zdomain).range(color);

        // create container
        var container = d3.select(selector)
            .append('div')
            .style('width', width)
            .style('height', height)
            .style('position', 'relative')

        // create svg
        var svg = container
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .style('position', 'absolute')
            .on('dblclick', reset)

        // automatically determine cell size to fill the grid
        if (ncol > nrow) {
            var size = Math.min((height - margin.top) / nrow, (width - margin.left) / ncol)
        } else {
            var size = (height - margin.top) / nrow
        }
        var y = d3.scale.ordinal().rangeBands([0, (nrow * size)]).domain(d3.range(nrow));
        var x = d3.scale.ordinal().rangeBands([0, (ncol * size)]).domain(d3.range(ncol));

        // adjust height and weight for canvas based on estimated size
        height = nrow * y.rangeBand();
        width = ncol * x.rangeBand();

        // set up variables to toggle with keypresses
        var clist = ['Purples', 'Blues', 'Greens', 'Oranges', 'Reds', 'Greys']
        var cindex = 0
        var scale = 0

        // create canvas
        var canvas = container
            .append('canvas')
            .attr('width', width)
            .attr('height', height)
            .attr('id', 'canvas1')
            .style('margin-left', margin.left + 'px')
            .style('margin-top', margin.top + 'px')

        var ctx = canvas
            .node().getContext("2d")

        // add keydown events
        d3.select(selector).attr('tabindex', -1)
        d3.select(selector).on('keydown', update)

        // compute a good font size
        var labelsize = (size * 72 / 96) / 5

        // draw the axis labels
        if (data.columns) {
            svg.selectAll('.column-label')
                .data(data.columns)
                .enter()
                .append("text")
                .attr("text-anchor", "start")
                .attr("transform", function(d, i) {
                    return "translate(" + (margin.left + x(i) + x.rangeBand() / 2) + 
                        "," +  margin.top * 0.8 + ")rotate(-60)" 
                })
                .attr("class", "axis-label column-label")
                .style("font-size", labelsize + "px")
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
                .attr("x", margin.left * 0.8)
                .attr("y", function(d, i) {return margin.top + y(i) + y.rangeBand() / 2})
                .attr("dy","0.35em")
                .attr("class", "axis-label row-label")
                .style("font-size", labelsize + "px")
                .text(function(d) {return d})
                .on('mouseover', highlight)
                .on('mouseout', unhighlight)
                .on('click', select)
        }

        // begin with nothing selected
        var selectedx = []
        var selectedy = []

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
            var el = d3.select(this)
            var thislabel = el.node().__data__
            var indx = _.indexOf(data.columns, thislabel)
            var indy = _.indexOf(data.rows, thislabel)
            if (indx > -1) {
                selectedx = getselected(selectedx, indx)
            }
            if (indy > -1) {
                selectedy = getselected(selectedy, indy)
            }
            console.log(selectedx)
            console.log(selectedy)
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
            selectedx = []
            selectedy = []
            draw()
        }

        // draw the matrix
        function draw() {

            d3.selectAll('.row-label').classed('selected-sticky', function(d) {
                if (selectedy.length > 0) {
                    if (_.indexOf(data.rows, d) == selectedy) {
                        return true
                    } else {
                        return false
                    }
                } else {
                    return false
                }
            })

            d3.selectAll('.column-label').classed('selected-sticky', function(d) {
                if (selectedx.length > 0) {
                    if (_.indexOf(data.columns, d) == selectedx) {
                        return true
                    } else {
                        return false
                    }
                } else {
                    return false
                }
            })

          // clear canvas
          ctx.clearRect(0, 0, width, height);
          
          _.forEach(data.entries, function(d) {

            var opacity
            if (selectedx.length > 0 | selectedy.length > 0) {
                if (selectedx.length > 0 & _.indexOf(selectedx, d.x) > -1) {
                    opacity = 1.0
                } else if (selectedy.length > 0 & _.indexOf(selectedy, d.y) > -1) {
                    opacity = 1.0
                } else {
                    opacity = 0.2
                }
            } else {
                opacity = 1.0
            }

            var fill = utils.buildRGBA(z(d.z), opacity)

            ctx.beginPath();
            ctx.fillStyle = fill;
            ctx.strokeStyle = 'white';
            ctx.lineWidth = strokeWidth;
            ctx.rect(x(d.x), y(d.y), x.rangeBand(), y.rangeBand());
            ctx.fill();
            ctx.stroke();
            ctx.closePath();

            // draw text labels
            if (data.labels) {
                var fontsize = (size * 72 / 96) / 2.5
                ctx.font = fontsize + "px monospace"
                if (d.z <= (zmax - zmin) / 2) {
                    if (opacity < 1.0) {
                        ctx.fillStyle = utils.buildRGBA('black', opacity / 5)
                    } else {
                        ctx.fillStyle = utils.buildRGBA('black', opacity)
                    }
                } else {
                    ctx.fillStyle = utils.buildRGBA('white', opacity)
                }
                ctx.textBaseline = 'middle'; 
                ctx.textAlign = 'center'; 
                ctx.fillText(d.z, x(d.x) + x.rangeBand() / 2, y(d.y) + y.rangeBand() / 2)
            }

          })
        }

        // update event for keypresses
        // TODO supplement with a window
        function update() {
            if (d3.event.keyCode == 38 | d3.event.keyCode == 40) {
                d3.event.preventDefault();
                if (d3.event.keyCode == 38) {
                    scale = scale + 0.05
                    if (scale > 0.4) {
                        scale = 0.4
                    }
                }
                if (d3.event.keyCode == 40) {
                    scale = scale - 0.05
                    if (scale < -3) {
                        scale = -3
                    }
                }
                var extent = zmax - zmin
                zdomain = utils.linspace(zmin + extent * scale, zmax - extent * scale, 9)
                z.domain(zdomain)
                draw();
            }
            if (d3.event.keyCode == 37 | d3.event.keyCode == 39) {
                d3.event.preventDefault();
                if (d3.event.keyCode == 37) {
                    cindex = cindex - 1
                    if (cindex < 0) {
                        cindex = clist.length - 1
                    }
                }
                if (d3.event.keyCode == 39) {
                    cindex = cindex + 1
                    if (cindex > clist.length - 1) {
                        cindex = 0
                    }
                }
                color = colormap(clist[cindex])
                z.range(color)
                draw();
            }
        }

        draw()
    },

    formatData: function(data) {
        var entries = []
        _.each(data.matrix, function(d, i) {
            _.each(d, function(e, j) {
                var p = {}
                p.x = j
                p.y = i
                p.z = e
                if (data.rows) {
                    p.r = data.rows[i]
                }
                if (data.columns) {
                    p.c = data.columns[j]
                }
                entries.push(p)
            })
        });

        var nrow = data.matrix.length
        var ncol = data.matrix[0].length
        console.log(data)
        var labels = data.labels ? data.labels : false
        return {entries: entries, nrow: nrow, ncol: ncol, colormap: data.colormap,
                rows: data.rows, columns: data.columns, labels: labels}
    },

    updateData: function(formattedData) {
        this.data = formattedData;
        // TODO: re-render the visualization
    },

    appendData: function(formattedData) {        
        // TODO: update this.data to include the newly
        //       added formattedData

        // TODO: re-render the visualization
    }

});


module.exports = Visualization;

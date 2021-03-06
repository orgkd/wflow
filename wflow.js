/**
 * Representation of simple workflows with SVG.
 * 
 * This library uses svg.js and jQuery for reperesentation of stages of some 
 * process. 
 * 
 * @module wflow
 * @author Alex O. <organ.a.f@gmail.com>
 * @version 1.0.0
 */
 
 /* global jQuery */
 /* global SVG */
 
(function($, SVG){
    
    /** Helper function for adding marker to line */
    function arrowMarker(add) {
        add.path('M 0 1 L 10 5 L 0 9 z').fill('black');
    }
    
    
    /**
     * Link between stages. Can be active or not. Active link means that transition
     * from one stage to another through this link already ocurred.
     * Note: currently only horisontal direction supported
     * 
     * @constructor
     * @memberof wflow
     * @this {Link}
     * @param {Stage} s1 First stage
     * @param {Stage} s2 Second stage
     * @param {String} direction Flow direction 
     */
    function Link(s1, s2, direction){
        
        if (s1.flow !== s2.flow) throw Error("Cannot connect stages in different flows");
        
        this.flow = s1.flow;
        this.from = s1;
        this.to = s2;
        s1.links.out.push(this);
        s2.links.in.push(this);
        direction = direction || this.HORISONTAL;
        
        if (direction == this.HORISONTAL){
            
            // Find connection points
            
            var p1, p2, points;
            
            
            if (s1.g.cx() < s2.g.cx()){
                p1 = s1.pivot.right;
                p2 = s2.pivot.left;
            } else {
                p1 = s1.pivot.left;
                p2 = s2.pivot.right;
            }
            if (Math.abs(s1.g.cy() - s2.g.cy()) > (s1.bb.height / 2)){
                p1 = s1.g.cy() < s2.g.cy() ? s1.pivot.bottom : s1.pivot.top;
            }
            points = [[p1.x, p1.y], [p2.x, p2.y]];
            
            // Draw line
            
            if (p1.y != p2.y){
                points.splice(1, 0, [p1.x, p2.y]);
            }

            this.line = this.flow.svg.polyline(points);
            this.line
                .stroke({ width: 1 })
                .marker('end', 10, 10, arrowMarker)
            ;
            
        } else if (direction == this.VERTICAL){
            
            // to be added soon
            throw Error("Vertical direction workflow not yet implemented");
            
        }
        
        /** Mark line as active */
        this.activate = function(){
            this.line.addClass('active');
        };
        
        /** Unmark line as active */
        this.deactivate = function(){
            this.line.removeClass('active');
        };
        
    }
    Link.prototype.HORISONTAL = "horisontal";
    Link.prototype.VERTICAL = "vertial";
    
    /**
     * Object represents single stage in workflow. 
     * 
     * @constructor
     * @memberof wflow
     * @param {Flow} flow Workfow to which stage belongs
     * @param {Object} options Stage options. See descriptions bellow.
     * @param {String} options.label Name of stage that will be displayed above  the icon
     * @param {Boolean} [options.fail] Indicates that ths tage is FAIL stage
     * @param {Boolean} [options.success] Indicates that ths tage is SUCCESS stage
     * @param {Boolean} [options.failable] Indicates that errors can occurr on this stage. 
     *      In ths case stage will be connected to FAIL stage with link.
     * @param {Number} [options.dx] Relative shift by X axis
     * @param {Number} [options.dy] Relative shift by Y axis
     * @param {String} options.id Id of group element in SVG
     * @param {String} options.image Icon representing the stage. By default it 
     *      looks like gear.
     * @param {String} options.status Status of processing of this stage. 
     */
    function Stage(flow, options){
        
        var h = 100
        ,   w = 100
        ,   stageno = flow.stages.length + 1
        ,   ICON_SIZE = 40
        ,   spof = 0.5
        ,   defaults = {
                svg: flow.svg,
                id: 's--stage-' + stageno,
                cx: stageno * w + (options.dx||0) + (flow.o.dx||0) + spof,
                cy: (flow.o.height / 2) + (options.dy||0) + (flow.o.dy||0) + spof,
                label: 'LABEL',
                image: flow.o.defaultImage,
                status: ''
            }
        ,   padding = {
                top: 20,
                bottom: 20,
                right: 20,
                left: 20
            }
        ;
    
        this.flow = flow;
        this.isactive = false;
        this.id = stageno - 1;
        this.options = $.extend(defaults, options);
        if (this.options.fail || this.options.succes) this.final = true;
        // Registry of incoming and outgoing links
        this.links = {
            "in": [],
            "out": []
        };
    
        
        this.g = flow.svg
            .group()
            .addClass(this.options.id)
            .addClass('s-stage')
        ;
        this.frame = this.g
            .rect(100, 100)
            .addClass('s-stage-frame')
        ;
        this.bb = this.frame.bbox();
        
        this.icon = this.g
            .image(this.options.image)
            .addClass('s-icon')
            .size(ICON_SIZE, ICON_SIZE)
            .cx(this.bb.cx)
            .attr({
                fill: 'red'
            })
            .cy(this.bb.cy)
        ;
        
        this.label = this.g
            .text(this.options.label)
            .addClass('s-label')
            .cx(this.bb.cx)
            .cy(this.bb.cy - 30)
        ;
        
        this.g.center(this.options.cx, this.options.cy);
        
        // Add attributes to pivot object which holds coordinates of 4 points
        this.pivot = {};
        ["top", "right", "bottom", "left"].forEach(function(type){
             Object.defineProperty(this.pivot, type, {
                get: function(){
                    return this.getPivotPoint(type);
                }.bind(this)
             });
        }.bind(this));
        
        /** Activate stage */
        this.activate = function(){
            var text = 'In progres...';
            if (this.options.fail) text = "FAIL";
            if (this.options.success) text = "SUCCESS";
            this.active = true;
            this.g.addClass("active");
            this.state(text);
            // Activate prev links if not a fail stage
            if (!this.options.fail) this.links.in.forEach(function(L){ 
                L.activate(); 
            }); 
            flow.active = this;
            return this;
        };
        
        /** Deactivate stage */
        this.deactivate = function(){
            this.active = false;
            this.g.removeClass("active");
            this.state(null);
            return this;
        };
        
        /** Mark stage as done */
        this.done = function(){
            this.deactivate();
            this.g.addClass('done');
            this.state("Done");
            this.links.in.forEach(function(L){ L.activate(); }); 
            if (this.prog != undefined) this.prog.remove();
            return this;
        };
        
        /**
         * Mark this stage as failed. When stage is failed it gets marked as error
         * and workflow goes to FAIL stage
         */
        this.error = function(){
            this.deactivate().state("ERROR").g.addClass('error');
            // Activate error link and error stage
            this.links.out.some(function(link){
                if (link.to === flow.failstage) {
                    link.activate();
                    return true;
                }
            });
            try{
                flow.failstage.activate();
            } catch (e){
                console.debug("No FAIL state in this workflow");
            }
        };
        
        /**
         * Get pivot point by type.
         * 
         * @param {string} point Point name: top, right, bottom, left
         * @return {object} Point coordinates
         */
        this.getPivotPoint = function(point){
            var C = {
                    x: this.g.cx(),
                    y: this.g.cy()
                }
            ,   w = this.g.bbox().width
            ,   h = this.g.bbox().height
            ;
            if (point == 'top'){
                return {
                    x: C.x,
                    y: C.y - h/2 + padding.top
                };
            } else if (point == 'right'){
                return {
                    x: C.x + w/2 - padding.right,
                    y: C.y
                };
            } else if (point == 'bottom'){
                return {
                    x: C.x,
                    y: C.y + h/2 - padding.bottom
                };
            } else if (point == 'left'){
                return {
                    x: C.x - w/2 + padding.left,
                    y: C.y
                };
            } else {
                console.error("Incorrect pivot point type: ", point);
            }
        };
        
        /**
         * Set stage state. 
         * 
         * @param {String|null} state New state. When null then state label will 
         *      be deleted. When undefined then runction will return state value
         * @return {Stage | String} 
         */
        this.state = function(state){
            
            if (state == undefined){
                return this._state;
            } else {
                
                if (state == null){
                    this._state = undefined;
                    if (this.stateLabel) this.stateLabel.remove();
                } else{
                    this._state = state;
                    if (this.stateLabel) this.stateLabel.remove();
                    this.stateLabel = this.g
                        .text(state)
                        .cx(this.bb.cx)
                        .cy(this.bb.cy + 30)
                        .addClass('s-state')
                    ;
                }
                
                return this;
            }
        };
        
        /**
         * Add progress label to stage
         * 
         * @param {Number|String} val Progress value. Three display modes: 
         *  - string - render label from string as is;
         *  - number (with total) - rendef in foramt "CURRENT / TOTAL"
         *  - number (without total) - render with % sign
         * @param {Number} [total] Total value
         */
        this.progress = function(val, total){
            if (this.prog != undefined) this.prog.remove();
            if (typeof val == 'number'){
                if (total == undefined){
                    val = val + "%";
                } else {
                    val = val + "/" + total;
                }
            }
            this.prog = this.g.text(val);
            this.prog
                .cx(this.bb.cx)
                .cy(this.bb.cy + 45)
                .addClass('s-progress');
        };
        
    }
    
    /**
     * Chain of stages is used to automatically connect consecutive stages.
     * 
     * @constructor
     * @memberof wflow
     * @param {Flow} flow Forkflow object
     * @param {Stage[]} stages Array of stages from left to right
     */
    function Chain(flow, stages){
        stages.forEach(function(stage, i, stages){
            var prevstage = stages[i-1];
            if (prevstage) {
                console.debug("Create connection from " + prevstage.options.label + 
                    " to " + stage.options.label);
                new Link(prevstage, stage);
            }
        });
    }
    
    /**
     * Opts dx, dy, fail, width, height
     * @constructor
     * @memberof wflow
     */
    function Flow(element, opts){
        
        var ICON_SIZE = 40
        ,   defauultWidth = "100%"
        ,   defaultHeight = 300
        ;
        
        this.options = opts || {};
        this.o = this.options;
        this.o.height = this.o.height || defaultHeight;
        this.o.width = this.o.width || defauultWidth;
        this.element = $(element);
        this.svg = SVG(this.element.attr('id')).size(this.o.width, this.o.height);
        this.bg = this.svg
            .rect('100%', '100%')
            .addClass('s--svg-frame')
            .attr({
                fill: 'white'
            });
        this.active = null;  // Index of active stage
        this.failstage = false;  // Reference to FAIL stage
        this.stages = [];
        
        this.element.addClass('wflow');
        
        /**
         * Render new stage with provided options.
         * 
         * @param {object} options Options which will be passed to Stage contructor
         */
        this.addStage = function(options){
            if (typeof options == "string") options = {label: options};
            var stage = new Stage(this, options);
            if (stage.options.fail) {
                this.failstage = stage;
                this.stages.forEach(function(S){
                    if (S.options.failable){
                        new Link(S, stage);
                    }
                });
            } else {
                this.stages.push(stage);
            }
            return stage;
        };
        
        /**
         * Arrow marker
         */
        function arrowMarker(add) {
            add.path('M 0 1 L 10 5 L 0 9 z').fill('black');
        }

        
        /**
         * Activate stage by label of index. By activating all revious tages will be 
         * deactivated and marked as DONE
         * @param {Number|String} stage Stage label or index
         */
        this.gotoStage = function(stage){
            if ((stage.options || {}).fail) throw Error("Can't go to FAIL stage");
            if (typeof stage == "number" && ( stage >= this.stages.length || stage < 0) ) 
                throw Error("Stage index out of range");
            var snumber = typeof stage == "number" ? stage : undefined
            ,   slabel = typeof stage == "string" ? stage : undefined
            ;
            if (snumber == undefined && slabel == undefined) 
                throw Error("Incorrect stage " + stage);
            
            // Mark previous stages as DONE
            
            this.stages.some(function(s,i){
                if (slabel == s.options.label || snumber == i) {
                    s.activate();
                    return true;
                } else {
                    s.done();
                }
            });
        };
        
        /** Activate next stage */
        this.next = function(){
            var stageno = -1;
            if (this.active !== null) stageno = this.active.id;
            this.gotoStage(stageno + 1);
            return this;
        };
        
        /** Workflow failed on current stage */
        this.throwErr = function(){
            this.active.error();
        };
        
        /**
         * Wrapper fof Chain function binded to current workflow. By default last
         * stage is supposed to be SUCCESS stage that indicates successfull comp-
         * letition of the workflow. You can customize this behavior by creating 
         * stages with Chain constructor.
         * 
         * @param {...object} stages Function takes stages as arguments
         * @return {Flow} Workflow obeject
         */
        this.chain = function(stages){
            stages = Array.prototype.map.call(arguments, function(s,i,stages){
                s = typeof s == 'string' ? {label: s} : s;
                if (i != 0 && i != stages.length - 1 && !s.hasOwnProperty('failable') ){
                    s.failable = true;
                } 
                if (i == stages.length - 1) s.success = true;
                return this.addStage(s);
            }.bind(this));
            console.log(stages);
            new Chain(this, stages);
            return this;
        };
        
        /**
         * Adds fail stage to the workflow. With adding fail stage also will be 
         * created links from intermediate stages of workflow. To prevent creation
         * of such links use failable=false in stage options. It's assumed that 
         * workflow cannot fail on START and SUCCESS stages. You can customize this 
         * behavior by creating stages using Chain constructor of this.addStage()
         * method.
         * @param {object} options Error stage options. 
         */
        this.addErrorStage = function(options){
            var opts = {
                label: "FAIL",
                fail: true,
                dy: 100,
                dx: -100
            };
            $.extend(opts, options);
            this.addStage(opts);
            return this;
        };
        
    }

    /**
     * This is entry point to wflow library
     * @namespace
     */
    this.wflow = {
        Flow: Flow,
        Stage: Stage,
        Chain: Chain,
        Link: Link
    };
    
})(jQuery, SVG);
 

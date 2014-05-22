// Copyright 2002-2013, University of Colorado Boulder

/**
 * Main class that represents one simulation.
 * Provides default initialization, such as polyfills as well.
 * If the simulation has only one screen, then there is no homescreen, home icon or screen icon in the navigation bar.
 *
 * @author Sam Reid
 */
define( function( require ) {
  'use strict';

  var Util = require( 'SCENERY/util/Util' );
  var NavigationBar = require( 'JOIST/NavigationBar' );
  var HomeScreen = require( 'JOIST/HomeScreen' );
  var Display = require( 'SCENERY/display/Display' );
  var Node = require( 'SCENERY/nodes/Node' );
  var Vector2 = require( 'DOT/Vector2' );
  var Bounds2 = require( 'DOT/Bounds2' );
  var Dimension2 = require( 'DOT/Dimension2' );
  var version = require( 'version' );
  var PropertySet = require( 'AXON/PropertySet' );
  var Property = require( 'AXON/Property' );
  var platform = require( 'PHET_CORE/platform' );
  var Timer = require( 'JOIST/Timer' );
  var SimJSON = require( 'JOIST/SimJSON' );

  /**
   * @param {String} name
   * @param {Array<Screen>} screens
   * @param options optional parameters for starting screen and home values, so that developers can easily specify the startup scenario for quick development
   * @constructor
   */
  function Sim( name, screens, options ) {

    options = _.extend( { showHomeScreen: true, screenIndex: 0, standalone: false, credits: {},

      //The screen display strategy chooses which way to switch screens, using setVisible or setChildren.
      //setVisible is faster in scenery 0.1 but crashes some apps due to memory restrictions, so some apps need to specify 'setChildren'
      //See https://github.com/phetsims/joist/issues/96
      screenDisplayStrategy: 'setVisible',
      showSaveAndLoad: false,
      batchEvents: false
    }, options );
    this.options = options; // store this for access from prototype functions, assumes that it won't be changed later

    this.destroyed = false;
    var sim = this;
    window.sim = sim;

    sim.name = name;
    sim.version = version();
    sim.credits = options.credits;

    sim.frameCounter = 0; // number of animation frames that have occurred

    sim.inputEventLog = []; // used to store input events and requestAnimationFrame cycles
    sim.inputEventWidth = 0;
    sim.inputEventHeight = 0;

    // state for mouse event fuzzing
    sim.fuzzMouseAverage = 10; // average number of mouse events to synthesize per frame
    sim.fuzzMouseIsDown = false;
    sim.fuzzMousePosition = new Vector2(); // start at 0,0
    sim.fuzzMouseLastMoved = false; // whether the last mouse event was a move (we skew probabilities based on this)

    //Set the HTML page title to the localized title
    //TODO: When a sim is embedded on a page, we shouldn't retitle the page
    $( 'title' ).html( name + ' ' + sim.version ); //TODO i18n of order

    //if nothing else specified, try to use the options for showHomeScreen & screenIndex from query parameters, to facilitate testing easily in different screens
    function stringToBoolean( string ) { return string === 'true'; }

    // Query parameters override options.
    if ( window.phetcommon && window.phetcommon.getQueryParameter && window.phetcommon.getQueryParameter( 'showHomeScreen' ) ) {
      options.showHomeScreen = stringToBoolean( window.phetcommon.getQueryParameter( 'showHomeScreen' ) );
    }
    if ( window.phetcommon && window.phetcommon.getQueryParameter && window.phetcommon.getQueryParameter( 'screenIndex' ) ) {
      options.screenIndex = parseInt( window.phetcommon.getQueryParameter( 'screenIndex' ), 10 );
    }
    if ( window.phetcommon && window.phetcommon.getQueryParameter && window.phetcommon.getQueryParameter( 'recordInputEventLog' ) ) {
      // enables recording of Scenery's input events, request animation frames, and dt's so the sim can be played back
      options.recordInputEventLog = true;
      options.inputEventLogName = window.phetcommon.getQueryParameter( 'recordInputEventLog' );
    }
    if ( window.phetcommon && window.phetcommon.getQueryParameter && window.phetcommon.getQueryParameter( 'playbackInputEventLog' ) ) {
      // instead of loading like normal, download a previously-recorded event sequence and play it back (unique to the browser and window size)
      options.playbackInputEventLog = true;
      options.inputEventLogName = window.phetcommon.getQueryParameter( 'playbackInputEventLog' );
    }
    if ( window.phetcommon && window.phetcommon.getQueryParameter && window.phetcommon.getQueryParameter( 'fuzzMouse' ) ) {
      // ignore any user input events, and instead fire mouse events randomly in an effort to cause an exception
      options.fuzzMouse = true;
      if ( window.phetcommon.getQueryParameter( 'fuzzMouse' ) !== 'undefined' ) {
        sim.fuzzMouseAverage = parseFloat( window.phetcommon.getQueryParameter( 'fuzzMouse' ) );
      }
    }
    if ( window.phetcommon && window.phetcommon.getQueryParameter && window.phetcommon.getQueryParameter( 'fuzzTouches' ) ) {
      // ignore any user input events, and instead fire touch events randomly in an effort to cause an exception
      options.fuzzTouches = true;
    }

    //If specifying 'standalone' then filter the screens array so that it is just the selected screenIndex
    if ( window.phetcommon && window.phetcommon.getQueryParameter && window.phetcommon.getQueryParameter( 'standalone' ) ) {
      options.standalone = true;
      screens = [screens[options.screenIndex]];
      options.screenIndex = 0;
    }

    //Default values are to show the home screen with the 1st screen selected
    var showHomeScreen = ( _.isUndefined( options.showHomeScreen ) ) ? true : options.showHomeScreen;

    //If there is only one screen, do not show the home screen
    if ( screens.length === 1 ) {
      showHomeScreen = false;
    }

    sim.screens = screens;

    //This model represents where the simulation is, whether it is on the home screen or a screen, and which screen it is on or is highlighted in the homescreen
    sim.simModel = new PropertySet( {showHomeScreen: showHomeScreen, screenIndex: options.screenIndex || 0 } );

    var $body = $( 'body' );
    $body.css( 'padding', '0' ).css( 'margin', '0' ).css( 'overflow', 'hidden' ); // prevent scrollbars

    // check to see if the sim div already exists in the DOM under the body. This is the case for https://github.com/phetsims/scenery/issues/174 (iOS offline reading list)
    if ( document.getElementById( 'sim' ) && document.getElementById( 'sim' ).parentNode === document.body ) {
      document.body.removeChild( document.getElementById( 'sim' ) );
    }

    sim.scene = new Node();
    sim.display = new Display( sim.scene, {
      allowSceneOverflow: true // we take up the entire browsable area, so we don't care about clipping
    } );
    var simDiv = sim.display.domElement;
    simDiv.id = 'sim';
    document.body.appendChild( simDiv );
    sim.scene.sim = sim; // add a reference back to the simulation
    sim.display.initializeWindowEvents( { batchDOMEvents: this.options.batchEvents } ); // sets up listeners on the document with preventDefault(), and forwards those events to our scene
    if ( options.recordInputEventLog ) {
      sim.display._input.logEvents = true; // flag Scenery to log all input events
    }
    window.simScene = sim.scene; // make the scene available for debugging
    window.simDisplay = sim.display; // make the display available for debugging

    var showPointers = window.phetcommon && window.phetcommon.getQueryParameter && window.phetcommon.getQueryParameter( 'showPointers' );
    this.showPointersProperty = new Property( showPointers );
    this.showPointersProperty.link( function( showPointers ) {
      sim.display.setPointerDisplayVisible( showPointers );
    } );

    var showPointerAreas = window.phetcommon && window.phetcommon.getQueryParameter && window.phetcommon.getQueryParameter( 'showPointerAreas' );
    this.showPointerAreasProperty = new Property( showPointerAreas );
    this.showPointerAreasProperty.link( function( showPointerAreas ) {
      sim.display.setPointerAreaDisplayVisible( showPointerAreas );
    } );

    var whiteNavBar = screens[0].backgroundColor === 'black' || screens[0].backgroundColor === '#000' || screens[0].backgroundColor === '#000000';
    sim.navigationBar = new NavigationBar( sim, screens, sim.simModel, whiteNavBar );

    if ( screens.length > 1 ) {
      sim.homeScreen = new HomeScreen( sim );
    }

    var updateBackground = function() {
      if ( sim.simModel.showHomeScreen ) {
        simDiv.style.backgroundColor = 'black';
      }
      else {
        var backgroundColor = screens[sim.simModel.screenIndex].backgroundColor || 'white';
        var cssColor = ( typeof backgroundColor === 'string' ) ? backgroundColor : backgroundColor.toCSS();
        simDiv.style.backgroundColor = cssColor;
      }
    };

    //Instantiate the screens
    //Currently this is done eagerly, but this pattern leaves open the door for loading things in the background.
    _.each( screens, function( screen ) {
      screen.model = screen.createModel();
      screen.view = screen.createView( screen.model );
    } );

    // this will hold the view for the current screen, and is initialized in the screenIndexProperty.link below
    var currentScreenNode;

    //ModuleIndex should always be defined.  On startup screenIndex=0 to highlight the 1st screen.
    //When moving from a screen to the homescreen, the previous screen should be highlighted

    //Choose the strategy for switching screens.  See options.screenDisplayStrategy documentation above
    if ( options.screenDisplayStrategy === 'setVisible' ) {

      if ( screens.length > 1 ) {
        sim.scene.addChild( sim.homeScreen );
      }
      _.each( screens, function( screen ) {
        sim.scene.addChild( screen.view );
      } );
      sim.scene.addChild( sim.navigationBar );
      sim.simModel.multilink( ['screenIndex', 'showHomeScreen'], function( screenIndex, showHomeScreen ) {
        if ( sim.homeScreen ) {
          sim.homeScreen.setVisible( showHomeScreen );
        }
        for ( var i = 0; i < screens.length; i++ ) {
          screens[i].view.setVisible( !showHomeScreen && screenIndex === i );
        }
        sim.navigationBar.setVisible( !showHomeScreen );
        updateBackground();
      } );
    }
    else if ( options.screenDisplayStrategy === 'setChildren' ) {
      //On startup screenIndex=0 to highlight the 1st screen.
      //When moving from a screen to the homescreen, the previous screen should be highlighted
      //When the user selects a different screen, show it.
      sim.simModel.screenIndexProperty.link( function( screenIndex ) {
        var newScreenNode = screens[screenIndex].view;
        var oldIndex = currentScreenNode ? sim.scene.indexOfChild( currentScreenNode ) : -1;

        // swap out the views if the old one is displayed. if not, we are probably in the home screen
        if ( oldIndex >= 0 ) {
          sim.scene.removeChild( currentScreenNode );
          sim.scene.insertChild( oldIndex, newScreenNode ); // same place in the tree, so nodes behind/in front stay that way.
        }

        currentScreenNode = newScreenNode;
        updateBackground();
      } );

      //When the user presses the home icon, then show the homescreen, otherwise show the screen and navbar
      sim.simModel.showHomeScreenProperty.link( function( showHomeScreen ) {
        var idx = 0;
        if ( showHomeScreen ) {
          if ( sim.scene.isChild( currentScreenNode ) ) {
            sim.scene.removeChild( currentScreenNode );
          }
          if ( sim.scene.isChild( sim.navigationBar ) ) {
            // place the home screen where the navigation bar was, if possible
            idx = sim.scene.indexOfChild( sim.navigationBar );
            sim.scene.removeChild( sim.navigationBar );
          }
          sim.scene.insertChild( idx, sim.homeScreen ); // same place in tree, to preserve nodes in front or behind
        }
        else {
          if ( sim.homeScreen && sim.scene.isChild( sim.homeScreen ) ) {
            // place the view / navbar at the same index as the homescreen if possible
            idx = sim.scene.indexOfChild( sim.homeScreen );
            sim.scene.removeChild( sim.homeScreen );
          }

          // same place in tree, to preserve nodes in front or behind
          sim.scene.insertChild( idx, currentScreenNode );
          sim.scene.insertChild( idx + 1, sim.navigationBar );
        }
        updateBackground();
      } );
    }

    updateBackground();

    //Fit to the window and render the initial scene
    $( window ).resize( function() { sim.resizeToWindow(); } );
    sim.resizeToWindow();
  }

  Sim.prototype = {
    constructor: Sim,
    
    resizeToWindow: function() {
      this.resize( window.innerWidth, window.innerHeight );
    },

    resize: function( width, height ) {
      var sim = this;

      //Use Mobile Safari layout bounds to size the home screen and navigation bar
      var scale = Math.min( width / 768, height / 504 );

      //40 px high on Mobile Safari
      var navBarHeight = scale * 40;
      sim.navigationBar.layout( scale, width, navBarHeight, height );
      sim.navigationBar.y = height - navBarHeight;
      sim.display.setSize( new Dimension2( width, height ) );

      //Layout each of the screens
      _.each( sim.screens, function( m ) { m.view.layout( width, height - sim.navigationBar.height ); } );

      if ( sim.homeScreen ) {
        sim.homeScreen.layoutWithScale( scale, width, height );
      }
      //Startup can give spurious resizes (seen on ipad), so defer to the animation loop for painting

      sim.display._input.eventLog.push( 'scene.display.setSize(new dot.Dimension2(' + width + ',' + height + '));' );

      //Fixes problems where the div would be way off center on iOS7
      if ( platform.mobileSafari ) {
        window.scrollTo( 0, 0 );
      }
    },

    start: function() {
      var sim = this;

      // if the playback flag is set, don't start up like normal. instead download our event log from the server and play it back.
      // if direct playback (copy-paste) is desired, please directly call sim.startInputEventPlayback( ... ) instead of sim.start().
      if ( this.options.playbackInputEventLog ) {
        var request = new XMLHttpRequest();
        request.open( 'GET', this.getEventLogLocation(), true );
        request.onload = function( e ) {
          // we create functions, so eval is necessary. we go to the loaded domain on a non-standard port, so cross-domain issues shouldn't present themselves
          /* jshint -W061 */
          sim.startInputEventPlayback( eval( request.responseText ) );
        };
        request.send();
        return;
      }

      //Keep track of the previous time for computing dt, and initially signify that time hasn't been recorded yet.
      var lastTime = -1;

      //Make sure requestAnimationFrame is defined
      Util.polyfillRequestAnimationFrame();

      //Record the pointers (if logging is enabled)
//    var logPointers = new LogPointers();
//    logPointers.startLogging();
//
//    //For debugging, display the pointers
//    logPointers.showPointers();

      // place the rAF *before* the render() to assure as close to 60fps with the setTimeout fallback.
      //http://paulirish.com/2011/requestanimationframe-for-smart-animating/
      (function animationLoop() {
        var dt, screen;

        // increment this before we can have an exception thrown, to see if we are missing frames
        sim.frameCounter++;

        if ( !sim.destroyed ) {
          window.requestAnimationFrame( animationLoop );
        }

        phetAllocation && phetAllocation( 'loop' );

        // fire or synthesize input events
        if ( sim.options.fuzzMouse ) {
          sim.fuzzMouseEvents();
        }
        else if ( sim.options.fuzzTouches ) {
          // TODO: we need more state tracking of individual touch points to do this properly
        }
        else {
          // if any input events were received and batched, fire them now.
          if ( sim.options.batchEvents ) {
            sim.display._input.fireBatchedEvents();
          }
        }

        //Update the active screen, but not if the user is on the home screen
        if ( !sim.simModel.showHomeScreen ) {

          //Compute the elapsed time since the last frame, or guess 1/60th of a second if it is the first frame
          var time = Date.now();
          var elapsedTimeMilliseconds = (lastTime === -1) ? (1000.0 / 60.0) : (time - lastTime);
          lastTime = time;

          //Convert to seconds
          dt = elapsedTimeMilliseconds / 1000.0;

          // step model and view (both optional)
          screen = sim.screens[sim.simModel.screenIndex];
          if ( screen.model.step ) {
            screen.model.step( dt );
          }
          if ( screen.view.step ) {
            screen.view.step( dt );
          }
        }

        Timer.step( dt );

        //If using the TWEEN animation library, then update all of the tweens (if any) before rendering the scene.
        //Update the tweens after the model is updated but before the scene is redrawn.
        if ( window.TWEEN ) {
          window.TWEEN.update();
        }
        if ( sim.options.recordInputEventLog ) {
          // push a frame entry into our inputEventLog
          var entry = {
            dt: dt,
            events: sim.display._input.eventLog,
            id: sim.frameCounter,
            time: Date.now()
          };
          if ( sim.inputEventWidth !== sim.display.width ||
               sim.inputEventHeight !== sim.display.height ) {
            sim.inputEventWidth = sim.display.width;
            sim.inputEventHeight = sim.display.height;

            entry.width = sim.inputEventWidth;
            entry.height = sim.inputEventHeight;
          }
          sim.inputEventLog.push( entry );
          sim.display._input.eventLog = []; // clears the event log so that future actions will fill it
        }
        sim.display.updateDisplay();
      })();

      //If state was specified, load it now
      if ( window.phetcommon && window.phetcommon.getQueryParameter && window.phetcommon.getQueryParameter( 'state' ) ) {
        var stateString = window.phetcommon.getQueryParameter( 'state' );
        var decoded = decodeURIComponent( stateString );
        sim.setState( JSON.parse( decoded, SimJSON.reviver ) );
      }
    },

    // Plays back input events and updateScene() loops based on recorded data. data should be an array of objects (representing frames) with dt and fireEvents( scene, dot )
    startInputEventPlayback: function( data ) {
      var sim = this;

      var index = 0; // our index into our frame data.

      //Make sure requestAnimationFrame is defined
      Util.polyfillRequestAnimationFrame();

      if ( data.length && data[0].width ) {
        sim.resize( data[0].width, data[0].height );
      }

      var startTime = Date.now();

      (function animationLoop() {
        var frame = data[index++];

        // when we have aready played the last frame
        if ( frame === undefined ) {
          var endTime = Date.now();

          var elapsedTime = endTime - startTime;
          var fps = data.length / ( elapsedTime / 1000 );

          // replace the page with a performance message
          document.body.innerHTML = '<div style="text-align: center; font-size: 16px;">' +
                                    '<h1>Performance results:</h1>' +
                                    '<p>Approximate frames per second: <strong>' + fps.toFixed( 1 ) + '</strong></p>' +
                                    '<p>Average time per frame (ms/frame): <strong>' + (elapsedTime / index).toFixed( 1 ) + '</strong></p>' +
                                    '<p>Elapsed time: <strong>' + elapsedTime + 'ms</strong></p>' +
                                    '<p>Number of frames: <strong>' + index + '</strong></p>' +
                                    '</div>';

          // ensure that the black text is readable (chipper-built sims have a black background right now)
          document.body.style.backgroundColor = '#fff';

          // bail before the requestAnimationFrame if we are at the end (stops the frame loop)
          return;
        }

        window.requestAnimationFrame( animationLoop );

        // we don't fire batched input events (prevents them from affecting unit/performance tests).
        // instead, we fire pre-recorded events for the scene if it exists (left out for brevity when not necessary)
        if ( frame.fireEvents ) { frame.fireEvents( sim.scene, function( x, y ) { return new Vector2( x, y ); } ); }

        //Update the active screen, but not if the user is on the home screen
        if ( !sim.simModel.showHomeScreen ) {
          sim.screens[sim.simModel.screenIndex].model.step( frame.dt ); // use the pre-recorded dt to ensure lack of variation between runs
        }

        //If using the TWEEN animation library, then update all of the tweens (if any) before rendering the scene.
        //Update the tweens after the model is updated but before the scene is redrawn.
        if ( window.TWEEN ) {
          window.TWEEN.update();
        }
        sim.display.updateDisplay();
      })();
    },

    addChild: function( node ) {
      this.scene.addChild( node );
    },

    // A string that should be evaluated as JavaScript containing an array of "frame" objects, with a dt and an optional fireEvents function
    getRecordedInputEventLogString: function() {
      return '[\n' + _.map( this.inputEventLog, function( item ) {
        var fireEvents = 'fireEvents:function(scene,dot){' + _.map( item.events, function( str ) { return 'display._input.' + str; } ).join( '' ) + '}';
        return '{dt:' + item.dt + ( item.events.length ? ',' + fireEvents : '' ) + ( item.width ? ',width:' + item.width : '' ) + ( item.height ? ',height:' + item.height : '' ) +
               ',id:' + item.id + ',time:' + item.time + '}';
      } ).join( ',\n' ) + '\n]';
    },

    // For recording and playing back input events, we use a unique combination of the user agent, width and height, so the same
    // server can test different recorded input events on different devices/browsers (desired, because events and coordinates are different)
    getEventLogName: function() {
      var name = this.options.inputEventLogName;
      if ( name === 'browser' ) {
        name = window.navigator.userAgent;
      }
      return ( this.name + '_' + name ).replace( /[^a-zA-Z0-9]/g, '_' );
    },

    // protocol-relative URL to the same-origin on a different port, for loading/saving recorded input events and frames
    getEventLogLocation: function() {
      var host = window.location.host.split( ':' )[0]; // grab the hostname without the port
      return '//' + host + ':8083/' + this.getEventLogName();
    },

    // submits a recorded event log to the same-origin server (run scenery/tests/event-logs/server/server.js with Node, from the same directory)
    submitEventLog: function() {
      // if we aren't recording data, don't submit any!
      if ( !this.options.recordInputEventLog ) { return; }

      var data = this.getRecordedInputEventLogString();

      var xmlhttp = new XMLHttpRequest();
      xmlhttp.open( 'POST', this.getEventLogLocation(), true ); // use a protocol-relative port to send it to Scenery's local event-log server
      xmlhttp.setRequestHeader( 'Content-type', 'text/javascript' );
      xmlhttp.send( data );
    },

    // submits a recorded event log to the same-origin server (run scenery/tests/event-logs/server/server.js with Node, from the same directory)
    mailEventLog: function() {
      // if we aren't recording data, don't submit any!
      if ( !this.options.recordInputEventLog ) { return; }

      var data = this.getRecordedInputEventLogString();

      window.open( 'mailto:phethelp@colorado.edu?subject=' + encodeURIComponent( this.name + ' input event log at ' + Date.now() ) + '&body=' + encodeURIComponent( data ) );
    },

    fuzzMouseEvents: function() {
      var sim = this;

      var chance;
      // run a variable number of events, with a certain chance of bailing out (so no events are possible)
      // models a geometric distribution of events
      while ( ( chance = Math.random() ) < 1 - 1 / sim.fuzzMouseAverage ) {
        var domEvent;
        if ( chance < ( sim.fuzzMouseLastMoved ? 0.02 : 0.4 ) ) {
          // toggle up/down
          domEvent = document.createEvent( 'MouseEvent' ); // not 'MouseEvents' according to DOM Level 3 spec

          // technically deprecated, but DOM4 event constructors not out yet. people on #whatwg said to use it
          domEvent.initMouseEvent( sim.fuzzMouseIsDown ? 'mouseup' : 'mousedown', true, true, window, 1, // click count
            sim.fuzzMousePosition.x, sim.fuzzMousePosition.y, sim.fuzzMousePosition.x, sim.fuzzMousePosition.y,
            false, false, false, false,
            0, // button
            null );

          sim.display._input.validatePointers();

          if ( sim.fuzzMouseIsDown ) {
            sim.display._input.mouseUp( sim.fuzzMousePosition, domEvent );
            sim.fuzzMouseIsDown = false;
          }
          else {
            sim.display._input.mouseDown( sim.fuzzMousePosition, domEvent );
            sim.fuzzMouseIsDown = true;
          }
        }
        else {
          // change the mouse position
          sim.fuzzMousePosition = new Vector2(
            Math.floor( Math.random() * sim.display.width ),
            Math.floor( Math.random() * sim.display.height )
          );

          // our move event
          domEvent = document.createEvent( 'MouseEvent' ); // not 'MouseEvents' according to DOM Level 3 spec

          // technically deprecated, but DOM4 event constructors not out yet. people on #whatwg said to use it
          domEvent.initMouseEvent( 'mousemove', true, true, window, 0, // click count
            sim.fuzzMousePosition.x, sim.fuzzMousePosition.y, sim.fuzzMousePosition.x, sim.fuzzMousePosition.y,
            false, false, false, false,
            0, // button
            null );

          sim.display._input.validatePointers();
          sim.display._input.mouseMove( sim.fuzzMousePosition, domEvent );
        }
      }
    },

    //Destroy a sim so that it will no longer consume any resources.  Used by sim nesting in Smorgasbord
    destroy: function() {
      this.destroyed = true;
      simDiv.parentNode && simDiv.parentNode.removeChild( simDiv );
    },

    //For save/load
    getState: function() {
      var state = {};
      for ( var i = 0; i < this.screens.length; i++ ) {
        state['screen' + i] = this.screens[i].getState();
      }
      state.simModel = this.simModel.get();

      return state;
    },

    setState: function( state ) {
      for ( var i = 0; i < this.screens.length; i++ ) {
        this.screens[i].setState( state['screen' + i] );
      }
      this.simModel.set( state.simModel );
    }
  };

  return Sim;
} );

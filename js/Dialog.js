// Copyright 2002-2013, University of Colorado Boulder

/**
 * General dialog type
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 * @author Sam Reid
 */
define( function( require ) {
  'use strict';

  // modules
  var inherit = require( 'PHET_CORE/inherit' );
  var Shape = require( 'KITE/Shape' );
  var Node = require( 'SCENERY/nodes/Node' );
  var Path = require( 'SCENERY/nodes/Path' );
  var Panel = require( 'SUN/Panel' );
  var RectangularPushButton = require( 'SUN/buttons/RectangularPushButton' );

  /**
   * @constructor
   * @param {Node} content - The content to display inside the dialog (not including the title)
   * @param {object} [options]
   */
  function Dialog( content, options ) {
    options = _.extend( {
      // Dialog-specific options
      modal: false, // {boolean} modal dialogs prevent interaction with the rest of the sim while open
      title: null, // {Node} title to be displayed at top
      titleAlign: 'center', // horizontal alignment of the title: {string} left, right or center
      titleSpacing: 20, // {number} how far the title is placed above the content
      hasCloseButton: true, // whether to put a close 'X' button is upper-right corner

      // {function} which sets the dialog's position in global coordinates. called as
      // layoutStrategy( dialog, simBounds, screenBounds, scale )
      layoutStrategy: Dialog.DEFAULT_LAYOUT_STRATEGY,

      // pass through to Panel options
      cornerRadius: 10, // {number} radius of the dialog's corners
      resize: true, // {boolean} whether to resize if content's size changes
      fill: 'white', // {string|Color}
      stroke: 'black', // {string|Color}
      backgroundPickable: true,
      xMargin: 20,
      yMargin: 20
    }, options );

    var dialog = this;

    this.isModal = options.modal;

    var dialogContent = new Node( {
      children: [content]
    } );

    if ( options.title ) {
      var titleNode = options.title;

      dialogContent.addChild( titleNode );

      var updateTitlePosition = function() {
        switch ( options.titleAlign ) {
          case 'center':
            titleNode.centerX = content.centerX;
            break;
          case 'left':
            titleNode.left = content.left;
            break;
          case 'right':
            titleNode.right = content.right;
            break;
          default:
            throw new Error( 'unknown titleAlign for Dialog: ' + options.titleAlign );
        }
        titleNode.bottom = content.top - options.titleSpacing;
      };

      if ( options.resize ) {
        content.addEventListener( 'bounds', updateTitlePosition );
        titleNode.addEventListener( 'bounds', updateTitlePosition );
      }
      updateTitlePosition();
    }

    if ( options.hasCloseButton ) {
      var crossSize = 10;
      var crossNode = new Path( new Shape().moveTo( 0, 0 ).lineTo( crossSize, crossSize ).moveTo( 0, crossSize ).lineTo( crossSize, 0 ), {
        stroke: '#fff',
        lineWidth: 3
      } );

      var closeButton = new RectangularPushButton( {
        content: crossNode,
        baseColor: '#d00', // TODO: color dependent on scheme?
        xMargin: 5,
        yMargin: 5,
        listener: function() {
          dialog.hide();
        }
      } );
      dialogContent.addChild( closeButton );

      var updateClosePosition = function() {
        closeButton.left = content.right + 10;
        if ( options.title ) {
          closeButton.top = options.title.top;
        } else {
          closeButton.top = content.top;
        }
      };

      if ( options.resize ) {
        content.addEventListener( 'bounds', updateClosePosition );
        if ( options.title ) {
          options.title.addEventListener( 'bounds', updateClosePosition );
        }
      }
      updateClosePosition();
    }

    Panel.call( this, dialogContent, options );

    var sim = window.phet.sim;

    function updateLayout() {
      options.layoutStrategy( dialog, sim.bounds, sim.screenBounds, sim.scale );
    }
    sim.on( 'resized', updateLayout );
    updateLayout();
  }

  Dialog.DEFAULT_LAYOUT_STRATEGY = function( dialog, simBounds, screenBounds, scale ) {
    dialog.setScaleMagnitude( scale );
    dialog.center = simBounds.center;
  };

  return inherit( Panel, Dialog, {
    show: function() {
      window.phet.sim.showPopup( this, this.isModal );
    },

    hide: function() {
      window.phet.sim.hidePopup( this, this.isModal );
    }
  } );
} );
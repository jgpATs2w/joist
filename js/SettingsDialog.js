// Copyright 2002-2013, University of Colorado Boulder

/**
 * Shows the about dialog.
 *
 * @author Sam Reid
 */
define( function( require ) {
  'use strict';

  var VBox = require( 'SCENERY/nodes/VBox' );
  var Rectangle = require( 'SCENERY/nodes/Rectangle' );
  var Text = require( 'SCENERY/nodes/Text' );
  var inherit = require( 'PHET_CORE/inherit' );
  var ScreenView = require( 'JOIST/ScreenView' );
  var Panel = require( 'SUN/Panel' );
  var CheckBox = require( 'SUN/CheckBox' );
  var PhetFont = require( 'SCENERY_PHET/PhetFont' );
  var Property = require( 'AXON/Property' );
  var TextButton = require( 'SUN/TextButton' );

  /**
   * @param {Sim} sim
   * @constructor
   */
  function SettingsDialog( sim ) {
    var settingsDialog = this;

    //Use view, to help center and scale content
    ScreenView.call( this, {renderer: 'svg'} );

    var content = new VBox( { align: 'center', spacing: 50, children: [
      new Text( 'Settings', { font: new PhetFont( 16 ) } ),
      new CheckBox( new Text( 'Show Pointers' ), sim.showPointersProperty ),
      new TextButton( 'Done', function() {
        settingsDialog.doneListeners.forEach( function( listener ) {
          listener();
        } );
      } )
    ]} );

    //Show a gray overlay that will help focus on the about dialog, and prevent clicks on the sim while the dialog is up
    this.addChild( new Panel( content, {centerX: this.layoutBounds.centerX, centerY: this.layoutBounds.centerY, xMargin: 20, yMargin: 20 } ) );

    function resize() {
      settingsDialog.layout( $( window ).width(), $( window ).height() );
    }

    //Fit to the window and render the initial scene
    $( window ).resize( resize );
    resize();
    this.doneListeners = [];
  }

  return inherit( ScreenView, SettingsDialog, {
    addDoneListener: function( listener ) {
      this.doneListeners.push( listener );
    }
  } );
} );
// Copyright 2013, University of Colorado

/**
 * Shows the home screen for a multi-tab simulation, which lets the user see all of the tabs and select one.
 *
 * @author Sam Reid
 */
define( function( require ) {
  "use strict";

  var Node = require( 'SCENERY/nodes/Node' );
  var HBox = require( 'SCENERY/nodes/HBox' );
  var Text = require( 'SCENERY/nodes/Text' );
  var inherit = require( 'PHET_CORE/inherit' );
  var TabView = require( 'JOIST/TabView' );
  var Frame = require( 'JOIST/Frame' );
  var Rectangle = require( 'SCENERY/nodes/Rectangle' );

  var HEIGHT = 70;

  function HomeScreen( title, tabs, model ) {
    var homeScreen = this;

    //Rendering in SVG seems to solve the problem that the home screen consumes 100% disk and crashes, see https://github.com/phetsims/joist/issues/17
    //Also makes it more responsive (and crisper on retina displays)
    TabView.call( this, {renderer: 'svg'} );

    this.backgroundColor = 'black';

    //iPad doesn't support Century Gothic, so fall back to Futura, see http://wordpress.org/support/topic/font-not-working-on-ipad-browser
    this.textLabel = new Text( title, {fontSize: 52, fontFamily: 'Century Gothic, Futura', fill: 'white', y: 140, centerX: this.layoutBounds.width / 2} );
    this.phetLabel = new Text( "PhET", {fontSize: 36, fill: 'yellow', top: 5, left: 5} );
    this.addChild( this.textLabel );
    this.addChild( this.phetLabel );

    var frameParent = new Node();
    this.addChild( frameParent );

    var index = 0;
    var tabChildren = _.map( tabs, function( tab ) {
      tab.index = index++;
      var child = new Node( {children: [tab.icon]} );
      child.smallTextLabel = new Text( tab.name, {fontSize: 18, fill: 'gray'} );
      child.largeTextLabel = new Text( tab.name, {fontSize: 42, fill: 'yellow'} );
      homeScreen.addChild( child.smallTextLabel );
      homeScreen.addChild( child.largeTextLabel );
      child.scale( HEIGHT / tab.icon.height );
      child.cursor = 'pointer';
      child.tab = tab;

      //Tap once to select, a second time to start that tab
      child.addInputListener( { down: function() {
        if ( model.tabIndex === tab.index ) {
          model.showHomeScreen = false;
        }
        else {
          model.tabIndex = tab.index;
        }
      }} );
      return child;
    } );

    var i;
    _.each( tabChildren, function( tabChild ) {
      homeScreen.addChild( tabChild );
      tabChild.addPeer( '<input type="button">', {click: function() {
        var tab = tabChild.tab;
        if ( model.tabIndex === tab.index ) {
          model.showHomeScreen = false;
        }
        else {
          model.tabIndex = tab.index;
        }
      }} );
    } );

    model.tabIndexProperty.link( function( tabIndex ) {
      var child = null;
      for ( i = 0; i < tabChildren.length; i++ ) {
        child = tabChildren[i];
        child.invalidateBounds();
        var selected = tabIndex === child.tab.index;
        child.selected = selected;
        child.opacity = selected ? 1 : 0.5;
        child.resetTransform();
        child.scale( selected ? HEIGHT / child.tab.icon.height * 2 : HEIGHT / child.tab.icon.height );
      }

      var width = 0;
      for ( i = 0; i < tabChildren.length; i++ ) {
        width = width + tabChildren[i].width;
      }

      //Space the icons out more if there are fewer, so they will be spaced nicely
      //Cannot have only 1 tab because for 1-tab sims there is no home screen.
      var spacing = tabs.length === 2 ? 100 :
                    tabs.length === 3 ? 60 :
                    33;
      width = width + spacing * (tabChildren.length - 1);

      var x = homeScreen.layoutBounds.width / 2 - width / 2;

      for ( i = 0; i < tabChildren.length; i++ ) {
        child = tabChildren[i];
        child.x = x;
        child.y = homeScreen.layoutBounds.height / 2 - 90;
        x += child.width + spacing;
        child.largeTextLabel.visible = child.selected;
        child.smallTextLabel.visible = !child.selected;
        var label = child.selected ? child.largeTextLabel : child.smallTextLabel;
        label.top = child.selected ? child.bottom + 10 : child.bottom + 4;
        if ( child.selected ) {
          label.centerX = child.centerX;
        }
        else {
          label.x = child.x;
        }

        //Create a decorative frame around the selected item, showing behind it
        if ( child.selected ) {
          frameParent.children = [new Frame( child )];
        }
      }
    } );
  }

  inherit( TabView, HomeScreen );

  return HomeScreen;
} );

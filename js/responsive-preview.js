/**
 * @file
 *
 * Provides a component that previews the a page in various device dimensions.
 */

(function ($, Drupal) {

  "use strict";

  Drupal.responsivePreview = Drupal.responsivePreview || {};

  var $toolbarTab = $();
  var $container; // The container of the page preview component.
  var $frame; // The iframe that contains the previewed page.
  var iframeDocument; // The document of the iframe that contains the preview.
  var size; // The width of the iframe container.
  var offset; // The left value of the iframe container.
  var device = {
    width: null, // The width of the device to preview.
    height: null // The height of the device to preview.
  };
  var edgeTolerance = 60;
  var parentWindow;

  /**
   * Attaches behaviors to the toolbar tab and preview containers.
   */
  Drupal.behaviors.responsivePreview = {
    attach: function (context, settings) {
      // once() returns a jQuery set. It will be empty if no unprocessed
      // elements are found. window and window.parent are equivalent unless the
      // Drupal page is itself wrapped in an iframe.
      var $body = $(window.parent.document.body).once('responsive-preview');

      if ($body.length) {
        // If this window is itself in an iframe it must be marked as processed.
        // Its parent window will have been processed above.
        // When attach() is called again for the preview iframe, it will check
        // its parent window and find it has been processed. In most cases, the
        // following code will have no effect.
        $(window.document.body).once('responsive-preview');
        // Retain a reference to the parent window.
        parentWindow = window;
        // Append the selector to the preview container.
        $toolbarTab = $('.responsive-preview-toolbar-tab')
          .on('click.responsivePreview', '#responsive-preview', toggleConfigurationOptions)
          .on('mouseleave.responsivePreview', '.responsive-preview-options', {open: false}, toggleConfigurationOptions)
          .on('click.responsivePreview', '.responsive-preview-options .responsive-preview-device', {open: false}, toggleConfigurationOptions)
          .on('click.responsivePreview', '.responsive-preview-device', loadDevicePreview);
        // Register a handler on window resize to reposition the tab dropdown.
        $(window)
          .on('resize.responsivePreview.tab', handleWindowToolbarResize);
      }
      // The main window is equivalent to window.parent and window.self. Inside,
      // an iframe, these objects are not equivalent. If the parent window is
      // itself in an iframe, check that the parent window has been processed.
      // If it has been, this invocation of attach() is being called on the
      // preview iframe, not its parent.
      if ((window.parent !== window.self) && !$body.length) {
        var $frameBody = $(window.self.document.body).once('responsive-preview');
        if ($frameBody.length > 0) {
          $frameBody.get(0).className += ' responsive-preview-frame';
        }
      }
    }
  };

  /**
   * Toggles the list of devices available to preview from the toolbar tab.
   *
   * @param {Object} event
   *   jQuery Event object.
   */
  function toggleConfigurationOptions (event) {
    event.preventDefault();
    var open = (event.data && typeof event.data.open === 'boolean') ? event.data.open : undefined;
    var $list = $(event.delegateTarget)
      // Set an open class on the tab wrapper.
      .toggleClass('open', open)
      .find('.responsive-preview-options');
    // The list of options might render outside the window.
    correctEdgeCollisions.call($list);
  }

  /**
   * Toggles the layout preview component on or off.
   *
   * When first toggled on, the layout preview component is built. All
   * subsequent toggles hide or show the built component.
   *
   * @param {Object} event
   *   jQuery Event object.
   *
   * @param {Boolean} activate
   *   A boolean that forces the preview to show (true) or to hide (false).
   */
  function toggleLayoutPreview (event, activate) {
    event.preventDefault();
    // Build the preview if it doesn't exist.
    if (!$container) {
      buildpreview();
    }
    $toolbarTab
      .find('> button')
      .toggleClass('active', activate);
    $container
      .toggleClass('active', activate);
    $('body')
      .toggleClass('responsive-preview-active', activate);
  }

  /**
   * Assembles a layout preview.
   */
  function buildpreview (window) {
    $(parentWindow.document.body).once('responsive-preview-container', function (index, element) {
      $container = $(Drupal.theme('layoutContainer'));

      // Add a close button.
      $container
        .append(Drupal.theme('layoutClose'));

      // Attach the iframe that will hold the preview.
      $frame = $(Drupal.theme('layoutFrame'))
        .css({ width: size })
        .appendTo($container);

      // Append the container to the window.
      $container.appendTo(parentWindow.document.body);
      // Displace the top of the container.
      $container
        .css({ top: getDisplacement('top') })
        .attr('data-offset-top', getDisplacement('top'));

      // The contentDocument property is not supported in IE until IE8.
      iframeDocument = $frame[0].contentDocument || $frame[0].contentWindow.document;

      $container
        .on('click.responsivePreview', '#responsive-preview-close', {activate: false}, toggleLayoutPreview)
        .on('sizeUpdate.responsivePreview', refreshPreviewSizing);

      // Trigger a resize to kick off some initial placements.
      $(parentWindow)
        .on('resize.responsivePreview', updateDimensions)
        .trigger('resize.responsivePreview');

      // Load the current page URI into the preview iframe.
      iframeDocument.location.href = Drupal.encodePath(Drupal.settings.currentPath);
    });
  }

  /**
   * Updates the dimension variables of the preview components.
   *
   * @param {Object} dimensions
   *   An object with the following properties:
   *    - {Number} width: The width the preview should be set to.
   *    - {Number} height (optional): The height the preview should be set to.
   *
   * @todo dimensions.height is not yet being used.
   */
  function updateDimensions () {
    var width = device.width || NaN;
    var height = device.height || NaN;
    var max = document.documentElement.clientWidth;
    var gutterPercent = (1 - (width / max)) / 2;
    var left = gutterPercent * max;
    // Set the left offset of the frame.
    // The gutters must be at least the width of the edgeTolerance
    left = (left < edgeTolerance) ? edgeTolerance : left;
    // The frame width must fit within the difference of the gutters and the
    // page width.
    width = (max - (left * 2) < width) ? max - (left * 2) : width;
    // Set the dimension variables in the closure.
    offset = left;
    size = width;
    // Trigger a dimension change.
    $container.trigger('sizeUpdate.responsivePreview');
  }

  /**
   * Handles refreshing the layout toolbar tab positioning.
   *
   * @param {Object} event
   *   jQuery Event object.
   */
  function handleWindowToolbarResize (event) {
    var $list = $toolbarTab.find('.responsive-preview-options');
    // Move the list back onto the screen.
    correctEdgeCollisions.call($list);
    // Update the display of the option items.
    var $options = $list.find('.responsive-preview-device');
    // Hide layout options that are wider than the current screen
    prunePreviewChoices.call($options, edgeTolerance);
    // Hide the tab if no options are visible. Show the tab if at least one is.
    $toolbarTab.toggle($options.parent('li').not('.element-hidden').length > 0);
  }

  /**
   * Resizes the preview iframe to the configured dimensions of a device.
   *
   * @param {Object} event
   *   A jQuery event object.
   */
  function loadDevicePreview (event) {
    event.preventDefault();
    var $link = $(event.target);
    device.width = $link.data('responsive-preview-width');
    device.height = $link.data('responsive-preview-height');
    // Toggle the preview on.
    toggleLayoutPreview(event, true);
    updateDimensions();
  }

  /**
   * Redraws the layout preview component based on the stored dimensions.
   *
   * @param {Object} event
   *   A jQuery event object.
   */
  function refreshPreviewSizing (event) {
    // Take RTL text direction into account.
    var dir = document.getElementsByTagName('html')[0].getAttribute('dir');
    var edge = (dir === 'rtl') ? 'right' : 'left';
    var options = {
      width: size
    };
    options[edge] = offset;
    $frame
      .stop(true, true)
      .animate(options, 'fast');
    // Reposition the close button.
    $('#responsive-preview-close')
      .css(edge, offset + size);
  }

  /**
   * Get the total displacement of given region.
   *
   * @param {String} region
   *   Region name. Either "top" or "bottom".
   *
   * @return {Number}
   *   The total displacement of given region in pixels.
   */
  function getDisplacement (region) {
    var displacement = 0;
    var lastDisplaced = $('[data-offset-' + region + ']');
    if (lastDisplaced.length) {
      displacement = parseInt(lastDisplaced.attr('data-offset-' + region), 10);
    }
    return displacement;
  }

  /**
   * Corrects element window edge collisions.
   *
   * Elements are moved back into the window if part of the element is
   * rendered outside the visible window.
   *
   * This should be invoked against a jQuery set like this:
   * correctEdgeCollisions.call($('div'));
   */
  function correctEdgeCollisions () {
    // Clear any previous corrections.
    clearStyling.call(this, ['top', 'right', 'bottom', 'left']);
    // Go through each element and correct edge collisions.
    return this.each(function (index, element) {
      var $this = $(this);
      var width = $this.width();
      var height = $this.height();
      var clientW = document.documentElement.clientWidth;
      var clientH = document.documentElement.clientHeight;
      var collisions = {
        'top': null,
        'right': null,
        'bottom': null,
        'left': null
      };
      // Determine if the element is too big for the document. Resize to fit.
      if (width > clientW) {
        $this.width(clientW);
        // If the element is too wide, it will collide on both left and right.
        collisions.left = true;
        collisions.right = true;
      }
      if (height > clientH) {
        $this.height(clientH);
        // If the element is too high, it will collide on both top and bottom.
        collisions.top = true;
        collisions.bottom = true;
      }
      // Check each edge for a collision.
      if (!collisions.top && $this.position().top < 0) {
        collisions.top = true;
      }
      if (!collisions.right && (($this.offset().left + width) > clientW)) {
        collisions.right = true;
      }
      if (!collisions.bottom && (($this.position().top + height) > clientH)) {
        collisions.bottom = true;
      }
      if (!collisions.left && $this.offset().left < 0) {
        collisions.left = true;
      }
      // Set the offset to zero for any collision on an edge.
      for (var edge in collisions) {
        if (collisions.hasOwnProperty(edge)) {
          if (collisions[edge]) {
            $this.css(edge, 0);
          }
        }
      }
    });
  }

  /**
   * Clears any previous styling.
   *
   * This should be invoked against a jQuery set like this:
   * clearStyling.call($('div'), ['left','right']);
   *
   * @param {Array} styles
   *   An array of strings where each string is the name of a CSS property.
   */
  function clearStyling (styles) {
    return this.each(function (index, element) {
      for (var i = 0; i < styles.length; i++) {
        if ('style' in this && styles[i] in this.style) {
          this.style[styles[i]] = "";
        }
      }
    });
  }

  /**
   * Hides device preview options that are too wide for the current window.
   *
   * This should be invoked against a jQuery set like this:
   * prunePreviewChoices.call($('div'), 20);
   *
   * @param {Number} tolerance
   *   The distance from the edge of the window that a device cannot exceed
   *   or it will be pruned from the list.
   */
  function prunePreviewChoices (tolerance) {
    var docWidth = document.documentElement.clientWidth;
    tolerance = (typeof tolerance === 'number' && tolerance > 0) ? tolerance : 0;
    return this.each(function () {
      var $this = $(this);
      var width = parseInt($this.data('responsive-preview-width'), 10);
      var fits = ((width + (tolerance * 2)) < docWidth);
      $this.parent('li').toggleClass('element-hidden', !fits);
    });
  }

  /**
   * Registers theme templates with Drupal.theme().
   */
  $.extend(Drupal.theme, {
    /**
     * Theme function for the preview container element.
     *
     * @return
     *   The corresponding HTML.
     */
    layoutContainer: function () {
      return '<div id="responsive-preview-container"><div class="responsive-preview-modal-background"></div></div>';
    },

    /**
     * Theme function for the close button for the preview container.
     *
     * @return
     *   The corresponding HTML.
     */
    layoutClose: function () {
      return '<button id="responsive-preview-close" role="button" aria-pressed="false"><span class="element-invisible">' + Drupal.t('Close') + '</span></button>';
    },

    /**
     * Theme function for a responsive preview iframe element.
     *
     * @return
     *   The corresponding HTML.
     */
    layoutFrame: function (url) {
      return '<iframe id="responsive-preview" frameborder="0" scrolling="auto" allowtransparency="true"></iframe>';
    }
  });

}(jQuery, Drupal));

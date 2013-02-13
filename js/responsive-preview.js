/**
 * @file responsive-preview.js
 *
 * Provides a component that previews the a page in various device dimensions.
 */
(function (Drupal, $) {

  Drupal.responsivePreview = Drupal.responsivePreview || {};

  var $toolbarTab = $();
  var $container; // The container of the page preview component.
  var $frame; // The iframe that contains the previewed page.
  var iframeDocument; // The document of the iframe that contains the preview.
  var size; // The width of the iframe container.
  var leftOffset; // The left value of the iframe container.
  var device = {
    width: null, // The width of the device to preview.
    height: null // The height of the device to preview.
  };
  var edgeTolerance = 60;

  Drupal.behaviors.responsivePreview = {
    attach: function (context, settings) {
      var $body = $(window.top.document.body).once('responsive-preview');

      if ($body.length) {
        // Append the selector to the preview container.
        $toolbarTab = $('.responsive-preview-toolbar-tab')
          .on('click.responsivePreview', '#responsive-preview', toggleConfigurationOptions)
          .on('mouseleave.responsivePreview', '.responsive-preview-options', {open: false}, toggleConfigurationOptions)
          .on('click.responsivePreview', '.responsive-preview-options .responsive-preview-device', {open: false}, toggleConfigurationOptions)
          .on('click.responsivePreview', '.responsive-preview-device', loadDevicePreview);
        // Register a handler on window resize to reposition the tab dropdown.
        $(window.top)
          .on('resize.responsivePreview.tab', handleWindowToolbarResize)
          .trigger('resize.responsivePreview.tab');
      }
      // Remove administrative elements in the document inside the iframe.
      if (window.top !== window.self) {
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
   *   - jQuery Event object.
   */
  function toggleConfigurationOptions (event) {
    event.preventDefault();
    var open = (event.data && typeof event.data.open === 'boolean') ? event.data.open : undefined;
    $(event.delegateTarget)
      // Set an open class on the tab wrapper.
      .toggleClass('open', open)
      .find('.responsive-preview-options')
      // The list of options will most likely render outside the window. Correct
      // this.
      .drupalLayout('correctEdgeCollisions');
  };

  /**
   * Toggles the layout preview component on or off.
   *
   * When first toggled on, the layout preview component is built. All
   * subsequent toggles hide or show the built component.
   *
   * @param {Object} event
   *   - jQuery Event object.
   *
   * @param {Boolean} activate
   *   - A boolean that forces the preview to show (true) or to hide (false).
   */
  function toggleLayoutPreview (event, activate) {
    event.preventDefault();
    // Build the preview if it doesn't exist.
    if (!$container) {
      buildpreview();
      // Size is the width of the iframe.
      updateDimensions({width: (size || window.top.document.documentElement.clientWidth)});
    }
    $container
      .toggleClass('active', activate)
    $('body')
      .toggleClass('responsive-preview-active', activate);
  }

  /**
   * Assembles a layout preview.
   */
  function buildpreview () {
    $(window.top.document.body).once('responsive-preview-container', function (index, element) {
      $container = $(Drupal.theme('layoutContainer'));

      // Add a close button.
      $container
        .append(Drupal.theme('layoutClose'));

      // Attach the iframe that will hold the preview.
      $frame = $(Drupal.theme('layoutFrame'))
        .css({
          'width': size
        })
        .appendTo($container);

      // Append the container to the window.
      $container.appendTo(window.top.document.body);
      // Displace the top of the container.
      $container
        .css({
          top: getDisplacement('top'),
        })
        .attr('data-offset-top', getDisplacement('top'));

      // The contentDocument property is not supported in IE until IE8.
      iframeDocument = $frame[0].contentDocument || $frame[0].contentWindow.document;

      $container
        .on('click.responsivePreview', '#responsive-preview-close', {activate: false}, toggleLayoutPreview)
        .on('sizeUpdate.responsivePreview', refreshPreviewSizing);

      // Trigger a resize to kick off some initial placements.
      $(window.top)
        .on('resize.responsivePreview', updateDimensions)
        .trigger('resize.responsivePreview');

      // Load the current page URI into the preview iframe.
      // @todo, are there any security implications to loading a page like this?
      iframeDocument.location.href = Drupal.settings.basePath + Drupal.settings.currentPath;
    });
  }

  /**
   * Updates the dimension variables of the preview components.
   *
   * @param {Object} dimensions
   *   - An object with the following properties:
   *     - {Number} width: The width the preview should be set to.
   *     - {Number} height (optional): The height the preview should be set to.
   *     Currently this is not used.
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
    leftOffset = left;
    size = width;
    // Trigger a dimension change.
    $container.trigger('sizeUpdate.responsivePreview');
  }

  /**
   * Handles refreshing the layout toolbar tab positioning.
   *
   * @param {Object} event
   *   - jQuery Event object.
   */
  function handleWindowToolbarResize (event) {
    var options = $toolbarTab
      .find('.responsive-preview-options')
      // Move the list back onto the screen.
      .drupalLayout('correctEdgeCollisions')
      .find('.responsive-preview-device')
      // Hide layout options that are wider than the current screen
      .drupalLayout('prunePreviewChoices', edgeTolerance)
      // The lis will be toggled. Assign them to options.
      .parent('li');

    $toolbarTab.toggle(options.not('.element-hidden').length > 0);
  }

  /**
   * Resizes the preview iframe to the configured dimensions of a device.
   *
   * @param {Object} event
   *   - A jQuery event object.
   */
  function loadDevicePreview (event) {
    event.preventDefault();
    var $link = $(event.target);
    device.width = $link.data('responsive-preview-width');
    device.height = $link.data('responsive-preview-height');
    // Toggle tbe preview on.
    toggleLayoutPreview(event, true);
    updateDimensions();
  }

  /**
   * Redraws the layout preview component based on the stored dimensions.
   *
   * @param {Object} event
   *   - A jQuery event object.
   */
  function refreshPreviewSizing (event) {
    $frame
      .stop(true, true)
      .animate({
        left: leftOffset,
        width: size
      }, 'fast');
    // Reposition the close button.
    $('#responsive-preview-close')
      .css({
        'left': (leftOffset + size)
      });
  }

  /**
   * Get the total displacement of given region.
   *
   * @param String region
   *   Region name. Either "top" or "bottom".
   *
   * @return
   *   The total displacement of given region in pixels.
   */
  function getDisplacement (region) {
    var displacement = 0;
    var lastDisplaced = $('[data-offset-' + region + ']');
    if (lastDisplaced.length) {
      displacement = parseInt(lastDisplaced.attr('data-offset-' + region));
    }
    return displacement;
  }

  /**
   * A jQuery plugin that contains element manipulation utilities.
   *
   * @return {Function}
   *   - The method to invoke this plugin.
   */
  $.fn.drupalLayout = (function () {

    /**
     * Corrects element window edge collisions.
     *
     * Elements are moved back into the window if part of the element is
     * rendered outside the visible window.
     */
    function correct () {
      // Clear any previous corrections.
      clear.apply(this);
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
        if (!collisions.top && $this.offset().top < 0) {
          collisions.top = true;
        }
        if (!collisions.right && (($this.offset().left + width) > clientW)) {
          collisions.right = true;
        }
        if (!collisions.bottom && (($this.offset().top + height) > clientH)) {
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
     * Clears any previous edge correction styling.
     */
    function clear () {
      var edges = ['top', 'right', 'bottom', 'left'];
      return this.each(function (index, element) {
        for (var i = 0; i < edges.length; i++) {
          this.style[edges[i]] = "";
        }
      });
    }

    /**
     * Hides device prevview options that are too wide for the current window.
     *
     * @param {Number} tolerance
     *   - The distance from the edge of the window that a device cannot exceed
     *   or it will be pruned from the list.
     */
    function prune (tolerance) {
      var docWidth = document.documentElement.clientWidth;
      tolerance = (typeof tolerance === 'number' && tolerance > 0) ? tolerance : 0;
      return this.each(function () {
        var $this = $(this);
        var width = parseInt($this.data('responsive-preview-width'));
        var fits = ((width + (tolerance * 2)) < docWidth);
        $this.parent('li').toggleClass('element-hidden', !fits);
      });
    }

    /**
     * Methods that this plugin exposes.
     */
    var methods = {
      'correctEdgeCollisions': correct,
      'prunePreviewChoices': prune
    };

    return function (method) {
      if (methods[method]) {
        return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
      }
      else {
        $.error(Drupal.t('Method @method does not exist in this plugin.', {'@method': method}));
      }
    };

  }());

  /**
   * Registers theme templates with Drupal.theme().
   */
  $.extend(Drupal.theme, {
    /**
     * Returns the preview container element.
     */
    layoutContainer: function () {
      return '<div id="responsive-preview-container"><div class="responsive-preview-modal-background"></div></div>';
    },

    /**
     * Returns the close button for the preview container.
     */
    layoutClose: function () {
      return '<button id="responsive-preview-close" role="button" aria-pressed="false">' + Drupal.t('Close') + '</button>';
    },

    /**
     * Returns an overlay iframe element.
     */
    layoutFrame: function (url) {
      return '<iframe id="responsive-preview" frameborder="0" scrolling="auto" allowtransparency="true"></iframe>';
    }
  });
}(Drupal, jQuery));

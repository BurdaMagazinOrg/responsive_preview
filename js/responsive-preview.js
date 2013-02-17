/**
 * @file
 *
 * Provides a component that previews the a page in various device dimensions.
 */

(function ($, Backbone, Drupal, window, document) {

  "use strict";

/**
 * Attaches behaviors to the toolbar tab and preview containers.
 */
Drupal.behaviors.responsivePreview = {
  attach: function (context, settings) {
    settings = settings || {};
    settings.responsivePreview = settings.responsivePreview || {};
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
      // Build the model and views.
      var model = new Drupal.responsivePreview.models.StateModel();
      // Retain a reference to the parent window.
      model.set({
        'parentWindow': window,
        'dir': document.getElementsByTagName('html')[0].getAttribute('dir'),
        'edgeTolerance': settings.responsivePreview.gutter || 60
      });
      // The toolbar tab view.
      var tabView = new Drupal.responsivePreview.views.TabView({
        el: $(context).find('#toolbar-tab-responsive-preview'),
        model: model
      });
      // The preview container view.
      var previewView = new Drupal.responsivePreview.views.ResponsivePreviewView({
        el: Drupal.theme('layoutContainer'),
        model: model
      });
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

Drupal.responsivePreview = Drupal.responsivePreview || {models: {}, views: {}};

/**
 * Backbone Model for the Responsive Preview.
 */
Drupal.responsivePreview.models.StateModel = Backbone.Model.extend({
  defaults: {
    // The state of the preview.
    isActive: false,
    // The state of toolbar list if available device previews.
    isDeviceListOpen: false,
    // The window that contains the body to which the preview container is
    // attached.
    parentWindow: null,
    // The number of devices that can be previewed at the current page width.
    optionsCount: 0,
    dimensions: {
      // The width of the device to preview.
      width: null,
      // The height of the device to preview.
      height: null,
      // The dots per pixel of the device to preview.
      dppx: null
    },
    // Take RTL text direction into account.
    dir: 'ltr',
    // The gutter size around the preview frame.
    edgeTolerance: 0
  }
});

/**
 * Handles responsive preview toggle interactions.
 */
Drupal.responsivePreview.views.TabView = Backbone.View.extend({
  events: {
    'click': '_toggleConfigurationOptions',
    'mouseleave': '_toggleConfigurationOptions',
    'click .responsive-preview-device': '_updateDeviceDetails'
  },

  /**
   * Implements Backbone Views' initialize().
   */
  initialize: function () {
    this.model.on('change:isActive', this.render, this);
    this.model.on('change:isDeviceListOpen', this.render, this);
    this.model.on('change:optionsCount', this.render, this);
    // Respond to window resizes.
    $(this.model.get('parentWindow'))
      .on('resize.responsivePreview.TabView', Drupal.debounce($.proxy(this._handleWindowToolbarResize, this), 250))
      // Trigger a resize to kick off some initial placements.
      .trigger('resize.responsivePreview.TabView');
  },

  /**
   * Implements Backbone Views' render().
   */
  render: function () {
    // Render the state.
    var isActive = this.model.get('isActive');
    var isDeviceListOpen = this.model.get('isDeviceListOpen');
    // Toggle the display of the toolbar tab.
    this.$el
      .find('> button')
      .toggleClass('active', isActive)
      .attr('aria-pressed', isActive);
    // When the preview is active, a class on the body is necessary to impose
    // styling to aid in the display of the preview element.
    $('body').toggleClass('responsive-preview-active', isActive);
    // Toggle the display of the device list.
    this.$el.toggleClass('open', isDeviceListOpen);
    // The list of options might render outside the window.
    if (isDeviceListOpen) {
      this._correctEdgeCollisions();
    }
    // Hide the tab if no options are visible. Show the tab if at least one is.
    this.$el.toggle(this.model.get('optionsCount') > 0);

    return this;
  },

  /**
   * Toggles the list of devices available to preview from the toolbar tab.
   *
   * @param Object event
   *   jQuery Event object.
   */
  _toggleConfigurationOptions: function (event) {
    // Force the options list closed on mouseleave.
    var open = (event.type === 'mouseleave') ? false : !this.model.get('isDeviceListOpen');
    this.model.set('isDeviceListOpen', open);

    event.preventDefault();
    event.stopPropagation();
  },

  /**
   * Corrects element window edge collisions.
   */
  _correctEdgeCollisions: function () {
    // The position of the dropdown depends on the language direction.
    var dir = this.model.get('dir');
    var edge = (dir === 'rtl') ? 'left' : 'right';
    // Correct edge collisions.
    this.$el.find('.responsive-preview-options')
      // Invoke jQuery UI position on the device options.
      .position({
        'my': edge +' top',
        'at': edge + ' bottom',
        'of': this.$el,
        'collision': 'flip fit'
      });
  },

  /**
   * Hides device preview options that are too wide for the current window.
   */
  _prunePreviewChoices: function () {
    var $options = this.$el.find('.responsive-preview-device')
    var tolerance = this.model.get('edgeTolerance');
    var docWidth = document.documentElement.clientWidth;
    // Remove choices that are too large for the current screen.
    $options.each(function (index, element) {
      var $this = $(this);
      var width = parseInt($this.data('responsive-preview-width'), 10);
      var dppx = parseFloat($this.data('responsive-preview-dppx'), 10);
      var iframeWidth = width / dppx;
      var fits = ((iframeWidth + (tolerance * 2)) < docWidth);
      $this.parent('li').toggleClass('element-hidden', !fits);
    });
    // Set the number of device options that are available.
    this.model.set('optionsCount', $options.parent('li').not('.element-hidden').length);
  },

  /**
   * Updates the model to reflect the dimensions of the chosen device.
   *
   * @param Object event
   *   A jQuery event object.
   */
  _updateDeviceDetails: function (event) {
    var $link = $(event.target);
    // Update the device dimensions.
    this.model.set('dimensions', {
      'width': parseInt($link.data('responsive-preview-width'), 10),
      'height': parseInt($link.data('responsive-preview-height'), 10),
      'dppx': parseFloat($link.data('responsive-preview-dppx'), 10)
    });
    // Toggle the preview on.
    this.model.set('isActive', true);

    event.preventDefault();
  },

  /**
   * Handles refreshing the layout toolbar tab on screen resize.
   *
   * @param Object event
   *   jQuery Event object.
   */
  _handleWindowToolbarResize: function (event) {
    this._correctEdgeCollisions();
    this._prunePreviewChoices();
  }

});

/**
 * Handles the responsive preview element interactions.
 */
Drupal.responsivePreview.views.ResponsivePreviewView = Backbone.View.extend({
  events: {
    'click #responsive-preview-close': 'remove'
  },

  /**
   * Implements Backbone Views' initialize().
   */
  initialize: function () {
    this.model.on('change:isActive', this.render, this);
    this.model.on('change:dimensions', this.render, this);

    // Recalculate the size of the preview container when the window resizes.
    $(this.model.get('parentWindow'))
      .on('resize.responsivePreview.ResponsivePreviewView', Drupal.debounce($.proxy(this.render, this), 250));
  },

  /**
   * Implements Backbone Views' render().
   */
  render: function () {
    // Render the state.
    var isActive = this.model.get('isActive');
    // Build the preview if it doesn't exist.
    if (!this.$el.hasClass('processed')) {
      this._build();
    }
    // Mark the preview element active.
    this.$el.toggleClass('active', isActive);
    // Refresh the dimensions of the preview container.
    if (isActive) {
      // Allow other scripts to respond to responsive preview events.
      $(document).trigger('drupalResponsivePreviewStarted');
      this._refresh();
    }

    return this;
  },

  /**
   * Implements Backbone Views' remove().
   */
  remove: function () {
    // Inactivate the previewer.
    this.model.set('isActive', false);
    // Allow other scripts to respond to responsive preview events.
    $(document).trigger('drupalResponsivePreviewStopped');
  },

  /**
   * Builds the iframe preview.
   */
  _build: function () {
    this.$el.append(Drupal.theme('layoutClose'));
    // Attach the iframe that will hold the preview.
    var $frame = $(Drupal.theme('layoutFrame'))
      .attr('data-loading', true)
      .appendTo(this.$el);
    // Displace the top of the container.
    this.$el
      .css({ top: this._getDisplacement('top') })
      .attr('data-offset-top', this._getDisplacement('top'))
      // Append the container to the body to initialize the iframe document.
      .appendTo(this.model.get('parentWindow').document.body);
    // The contentDocument property is not supported in IE until IE8.
    var iframeDocument = $frame[0].contentDocument || $frame[0].contentWindow.document;
    // Load the current page URI into the preview iframe.
    var path = Drupal.settings.currentPath;
    if (path.charAt(0) !== '/') {
      path = '/' + path;
    }
    iframeDocument.location.href = Drupal.encodePath(path);
    // Mark the preview element processed.
    this.$el.addClass('processed');
  },

  /**
   * Redraws the layout preview component based on the stored dimensions.
   *
   * @param Object event
   *   A jQuery event object.
   */
  _refresh: function (event) {
    var $frame = this.$el.find('#responsive-preview');
    var dir = this.model.get('dir');
    var edge = (dir === 'rtl') ? 'right' : 'left';
    var dimensions = this.model.get('dimensions');
    var tolerance = this.model.get('edgeTolerance');
    var max = document.documentElement.clientWidth;
    var width = dimensions.width / dimensions.dppx;
    var height = dimensions.height / dimensions.dppx;
    var gutterPercent = (1 - (width / max)) / 2;
    var offset = gutterPercent * max;
    // Set the offset of the frame.
    // The gutters must be at least the width of the tolerance.
    offset = (offset < tolerance) ? tolerance : offset;
    // The frame width must fit within the difference of the gutters and the
    // page width.
    width = (max - (offset * 2) < width) ? max - (offset * 2) : width;
    // Position the iframe.
    $frame
      .stop(true, true)
      .animate({
        width: width,
        height: height
      }, 'fast');
    var options = {};
    // The edge depends on the text direction.
    options[edge] = offset;
    $frame.css(options);
    // Position the close button.
    this.$el.find('#responsive-preview-close').css(edge, offset + width);
    // Calculate the CSS properties to scale the preview appropriately.
    var scalingCSS = this._calculateScaling();
    // The first time we need to apply scaling magic, we must wait until the
    // frame has loaded.
    var view = this;
    $frame.on('load.responsivePreview.ResponsivePreviewView', function() {
      $frame.removeAttr('data-loading');
      view._applyScaling(scalingCSS);
    });
    // We don't have to wait for the frame to load anymore.
    if ($frame.attr('data-loading') === undefined) {
      this._applyScaling(scalingCSS);
    }
  },

  /**
   * Determines device scaling ratios from the viewport information.
   */
  _calculateScaling: function () {
    var settings = {};

    // Parse <meta name="viewport" />, if any.
    var $viewportMeta = $(document).find('meta[name=viewport][content]');
    if ($viewportMeta.length > 0) {
      // Parse something like this:
      //   <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, minimum-scale=1, user-scalable=yes">
      // into this:
      //   {
      //     width: 'device-width',
      //     initial-scale: '1',
      //     maximum-scale: '5',
      //     minimum-scale: '1',
      //     user-scalable: 'yes'
      //   }
      $viewportMeta
        .attr('content')
        // Reduce multiple parts of whitespace to a single space.
        .replace(/\s+/g, '')
        // Split on comma (which separates the different settings).
        .split(',')
        .map(function (setting) {
          setting = setting.split('=');
          settings[setting[0]] = setting[1];
        });
    }

    var pageWidth;
    if (settings.width) {
      if (settings.width === 'device-width') {
        // Don't scale if the page is marked to be as wide as the device.
        return {};
      }
      else {
        pageWidth = parseInt(settings.width, 10);
      }
    }
    else {
      // Viewport default width of iPhone.
      pageWidth = 980;
    }

    var pageHeight = undefined;
    if (settings.height && settings.height !== 'device-height') {
      pageHeight = parseInt(settings.height, 10);
    }

    var initialScale = 1;
    if (settings['initial-scale']) {
      initialScale = parseFloat(settings['initial-scale'], 10);
      if (initialScale < 1) {
        // Viewport default width of iPhone.
        pageWidth = 980;
      }
    }

    // Calculate the scale, ensure it lies in the (0.25, 2) range.
    var scale = initialScale * (100 / pageWidth) * (size / 100);
    scale = Math.min(scale, 2);
    scale = Math.max(scale, 0.25);

    var transform;
    var origin;
    transform = "scale(" + scale + ")";
    origin = "0 0";
    return {
        'min-width': pageWidth + 'px',
        'min-height': pageHeight + 'px',
        '-webkit-transform': transform,
            '-ms-transform': transform,
                'transform': transform,
        '-webkit-transform-origin': origin,
            '-ms-transform-origin': origin,
                'transform-origin': origin
    };
  },

  /**
   * Applies scaling in order to bette approximate content display on a device.
   */
  _applyScaling: function (scalingCSS) {
    var $frame = this.$el.find('#responsive-preview');
    var $html = $($frame[0].contentDocument || $frame[0].contentWindow.document).find('html');

    function isTransparent (color) {
      // TRICKY: edge case for Firefox' "transparent" here; this is a
      // browser bug: https://bugzilla.mozilla.org/show_bug.cgi?id=635724
      return (color === 'rgba(0, 0, 0, 0)' || color === 'transparent');
    }

    // Scale if necessary.
    $html.css(scalingCSS);

    // When scaling (as we did), the background (color and image) doesn't scale
    // along. Fortunately, we can fix things in case of background color.
    // @todo: figure out a work-around for background images, or somehow
    // document this explicitly.
    var htmlBgColor = $html.css('background-color');
    var bodyBgColor = $html.find('body').css('background-color');
    if (!isTransparent(htmlBgColor) || !isTransparent(bodyBgColor)) {
      var bgColor = isTransparent(htmlBgColor) ? bodyBgColor : htmlBgColor;
      $frame.css('background-color', bgColor);
    }
  },

  /**
   * Gets the total displacement of given region.
   *
   * @param String region
   *   Region name. Either "top" or "bottom".
   *
   * @return Number
   *   The total displacement of given region in pixels.
   */
  _getDisplacement: function (region) {
    var displacement = 0;
    var lastDisplaced = $('[data-offset-' + region + ']');
    if (lastDisplaced.length) {
      displacement = parseInt(lastDisplaced.attr('data-offset-' + region), 10);
    }
    return displacement;
  }
});

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

}(jQuery, Backbone, Drupal, window, document));

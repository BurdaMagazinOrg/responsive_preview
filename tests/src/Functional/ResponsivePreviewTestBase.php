<?php

namespace Drupal\Tests\responsive_preview\Functional;

use Drupal\Component\Render\FormattableMarkup;
use Drupal\Tests\BrowserTestBase;

/**
 * Responsive preview base test class.
 */
abstract class ResponsivePreviewTestBase extends BrowserTestBase {

  /**
   * Modules to enable.
   *
   * @var array
   */
  public static $modules = ['responsive_preview'];

  /**
   * Return the default devices.
   *
   * @param boolean $enabled_only
   *   Whether return only devices enabled by default.
   *
   * @return array
   *   An array of the default devices.
   */
  protected function getDefaultDevices($enabled_only = FALSE) {
    $devices = [
      'iphone6' => 'iPhone 6',
      'iphone6plus' => 'iPhone 6+',
      'nexus5' => 'Nexus 5',
      'nexus6' => 'Nexus 6',
      'nexus9' => 'Nexus 9',
    ];

    if ($enabled_only) {
      return $devices;
    }

    $devices += [
      'large' => 'Typical desktop',
      'medium' => 'Tablet',
      'small' => 'Smart phone'
    ];

    return $devices;
  }

  /**
   * Tests exposed devices in the responsive preview list.
   *
   * @param array $devices
   *   An array of devices to check.
   */
  protected function assertDeviceListEquals(array $devices) {
    $device_buttons = $this->xpath('//button[@data-responsive-preview-name]');
    $this->assertTrue(count($devices) === count($device_buttons));

    foreach ($device_buttons as $button) {
      $name = $button->getAttribute('data-responsive-preview-name');
      $this->assertTrue(!empty($name) && in_array($name, $devices), new FormattableMarkup('%name device shown', ['%name' => $name]));
    }
  }

  /**
   * Asserts whether responsive preview cache metadata is present.
   */
  protected function assertResponsivePreviewCachesTagAndContexts() {
    $this->assertSession()->responseHeaderContains('X-Drupal-Cache-Tags', 'config:responsive_preview_device_list');
    $this->assertSession()->responseHeaderContains('X-Drupal-Cache-Contexts', 'route.is_admin');
  }

  /**
   * Asserts whether responsive preview cache metadata is not present.
   */
  protected function assertNoResponsivePreviewCachesTagAndContexts() {
    $this->assertSession()->responseHeaderNotContains('X-Drupal-Cache-Tags', 'config:responsive_preview_device_list');
    $this->assertSession()->responseHeaderNotContains('X-Drupal-Cache-Contexts', 'route.is_admin');
  }

  /**
   * Asserts whether responsive preview library is included.
   */
  protected function assertResponsivePreviewLibrary() {
    $this->assertSession()->responseContains('modules/responsive_preview/js/responsive-preview.js');
    $this->assertSession()->responseContains('modules/responsive_preview/css/responsive-preview.icons.css');
    $this->assertSession()->responseContains('modules/responsive_preview/css/responsive-preview.module.css');
    $this->assertSession()->responseContains('modules/responsive_preview/css/responsive-preview.theme.css');
  }

  /**
   * Asserts whether responsive preview library is not included.
   */
  protected function assertNoResponsivePreviewLibrary() {
    $this->assertSession()->responseNotContains('modules/responsive_preview/js/responsive-preview.js');
    $this->assertSession()->responseNotContains('modules/responsive_preview/css/responsive-preview.icons.css');
    $this->assertSession()->responseNotContains('modules/responsive_preview/css/responsive-preview.module.css');
    $this->assertSession()->responseNotContains('modules/responsive_preview/css/responsive-preview.theme.css');
  }

}

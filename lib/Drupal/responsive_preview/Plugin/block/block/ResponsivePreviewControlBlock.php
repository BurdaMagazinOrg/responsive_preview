<?php

/**
 * @file
 * Contains \Drupal\responsive_preview\Plugin\block\block\ResponsivePreviewControlBlock.
 */

namespace Drupal\responsive_preview\Plugin\block\block;

use Drupal\block\BlockBase;
use Drupal\Component\Annotation\Plugin;
use Drupal\Core\Annotation\Translation;

/**
 * Provides a 'Responsive preview controls' block.
 *
 * @Plugin(
 *   id = "responsive-preview-controls",
 *   admin_label = @Translation("Responsive preview controls"),
 *   module = "responsive_preview"
 * )
 */
class ResponsivePreviewControlBlock extends BlockBase {

  /**
   * Implements \Drupal\block\BlockBase::build().
   */
  public function build() {
    $block = array(
      'device_options' => array(
        '#theme' => 'item_list',
        '#items' => responsive_preview_get_devices_list(),
        '#attributes' => array(
          'class' => array('options'),
        ),
        '#attached' => array(
          'library' => array(
            array('responsive_preview', 'responsive-preview'),
          ),
        ),
      ),
    );

    return $block;
  }

}

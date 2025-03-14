import {
  menu,
  type MenuConfig,
  popMenu,
  popupTargetFromElement,
} from '@blocksuite/affine-components/context-menu';
import { unsafeCSSVarV2 } from '@blocksuite/affine-shared/theme';
import { ShadowlessElement } from '@blocksuite/block-std';
import { SignalWatcher, WithDisposable } from '@blocksuite/global/lit';
import {
  DeleteIcon,
  DuplicateIcon,
  InsertLeftIcon,
  InsertRightIcon,
  MoveLeftIcon,
  MoveRightIcon,
  ViewIcon,
} from '@blocksuite/icons/lit';
import { css } from 'lit';
import { property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { html } from 'lit/static-html.js';

import { inputConfig, typeConfig } from '../../../core/common/property-menu.js';
import type { Property } from '../../../core/view-manager/property.js';
import { numberFormats } from '../../../property-presets/number/utils/formats.js';
import { DEFAULT_COLUMN_TITLE_HEIGHT } from '../consts.js';
import type { TableColumn, TableSingleView } from '../table-view-manager.js';

export class MobileTableColumnHeader extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  static override styles = css`
    .mobile-table-column-header {
      display: flex;
      padding: 6px;
      gap: 6px;
      align-items: center;
    }

    .mobile-table-column-header-icon {
      font-size: 18px;
      color: ${unsafeCSSVarV2('database/textSecondary')};
      display: flex;
      align-items: center;
    }

    .mobile-table-column-header-name {
      font-weight: 500;
      font-size: 14px;
      color: ${unsafeCSSVarV2('database/textSecondary')};
    }
  `;

  private readonly _clickColumn = () => {
    if (this.tableViewManager.readonly$.value) {
      return;
    }
    this.popMenu();
  };

  editTitle = () => {
    this._clickColumn();
  };

  private _setDefaultValue() {
    const column = this.column;
    const propertyMeta = this.tableViewManager.propertyMetaGet(
      column.type$.value
    );
    if (!propertyMeta) return;

    const currentDefaultValue = this.tableViewManager.columnGetDefaultValue(
      column.id
    );

    // Create input based on property type
    const propertyType = column.type$.value;
    let inputConfig;

    if (propertyType === 'number') {
      inputConfig = menu.input({
        placeholder: 'Enter default number value',
        initialValue:
          currentDefaultValue !== undefined ? String(currentDefaultValue) : '',
        onComplete: value => {
          const numValue = Number(value);
          if (!isNaN(numValue)) {
            this.tableViewManager.columnSetDefaultValue(column.id, numValue);
          } else if (value === '') {
            this.tableViewManager.columnRemoveDefaultValue(column.id);
          }
        },
      });
    } else if (propertyType === 'checkbox') {
      inputConfig = menu.action({
        name: 'Set as checked by default',
        isSelected: !!currentDefaultValue,
        select: () => {
          if (currentDefaultValue) {
            this.tableViewManager.columnRemoveDefaultValue(column.id);
          } else {
            this.tableViewManager.columnSetDefaultValue(column.id, true);
          }
        },
      });
    } else {
      // Default to text input for other types
      inputConfig = menu.input({
        placeholder: 'Enter default value',
        initialValue:
          currentDefaultValue !== undefined ? String(currentDefaultValue) : '',
        onComplete: value => {
          if (value) {
            this.tableViewManager.columnSetDefaultValue(column.id, value);
          } else {
            this.tableViewManager.columnRemoveDefaultValue(column.id);
          }
        },
      });
    }

    popMenu(popupTargetFromElement(this), {
      options: {
        title: {
          text: `Default Value for ${column.name$.value}`,
        },
        items: [
          inputConfig,
          menu.action({
            name:
              currentDefaultValue !== undefined
                ? `Current: ${String(currentDefaultValue)}`
                : 'No default value set',
            class: {
              'menu-item-info': true,
            },
            prefix: html`<svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style="color: var(--affine-text-secondary-color);"
            >
              <path
                d="M8 1.5C4.41015 1.5 1.5 4.41015 1.5 8C1.5 11.5899 4.41015 14.5 8 14.5C11.5899 14.5 14.5 11.5899 14.5 8C14.5 4.41015 11.5899 1.5 8 1.5ZM8 13.5C4.96243 13.5 2.5 11.0376 2.5 8C2.5 4.96243 4.96243 2.5 8 2.5C11.0376 2.5 13.5 4.96243 13.5 8C13.5 11.0376 11.0376 13.5 8 13.5Z"
                fill="currentColor"
              />
              <path
                d="M8 7C8.27614 7 8.5 7.22386 8.5 7.5V10.5C8.5 10.7761 8.27614 11 8 11C7.72386 11 7.5 10.7761 7.5 10.5V7.5C7.5 7.22386 7.72386 7 8 7Z"
                fill="currentColor"
              />
              <path
                d="M8 6C8.41421 6 8.75 5.66421 8.75 5.25C8.75 4.83579 8.41421 4.5 8 4.5C7.58579 4.5 7.25 4.83579 7.25 5.25C7.25 5.66421 7.58579 6 8 6Z"
                fill="currentColor"
              />
            </svg>`,
            select: () => {
              // Это информационный пункт, ничего не делаем при клике
            },
          }),
          menu.action({
            name: 'Clear Default Value',
            hide: () => currentDefaultValue === undefined,
            select: () => {
              this.tableViewManager.columnRemoveDefaultValue(column.id);
            },
          }),
        ],
      },
    });
  }

  private popMenu(ele?: HTMLElement) {
    const enableNumberFormatting =
      this.tableViewManager.featureFlags$.value.enable_number_formatting;

    popMenu(popupTargetFromElement(ele ?? this), {
      options: {
        title: {
          text: 'Property settings',
        },
        items: [
          inputConfig(this.column),
          typeConfig(this.column),
          // Number format begin
          ...(enableNumberFormatting
            ? [
                menu.subMenu({
                  name: 'Number Format',
                  hide: () =>
                    !this.column.dataUpdate ||
                    this.column.type$.value !== 'number',
                  options: {
                    title: {
                      text: 'Number Format',
                    },
                    items: [
                      numberFormatConfig(this.column),
                      ...numberFormats.map(format => {
                        const data = this.column.data$.value;
                        return menu.action({
                          isSelected: data.format === format.type,
                          prefix: html`<span
                            style="font-size: var(--affine-font-base); scale: 1.2;"
                            >${format.symbol}</span
                          >`,
                          name: format.label,
                          select: () => {
                            if (data.format === format.type) return;
                            this.column.dataUpdate(() => ({
                              format: format.type,
                            }));
                          },
                        });
                      }),
                    ],
                  },
                }),
              ]
            : []),
          // Number format end
          menu.group({
            items: [
              menu.action({
                name: 'Hide In View',
                prefix: ViewIcon(),
                hide: () => !this.column.hideCanSet,
                select: () => {
                  this.column.hideSet(true);
                },
              }),
              menu.action({
                name: 'Set Default Value',
                prefix: html`<svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M8 1.5C4.41015 1.5 1.5 4.41015 1.5 8C1.5 11.5899 4.41015 14.5 8 14.5C11.5899 14.5 14.5 11.5899 14.5 8C14.5 4.41015 11.5899 1.5 8 1.5ZM8 13.5C4.96243 13.5 2.5 11.0376 2.5 8C2.5 4.96243 4.96243 2.5 8 2.5C11.0376 2.5 13.5 4.96243 13.5 8C13.5 11.0376 11.0376 13.5 8 13.5Z"
                    fill="currentColor"
                  />
                  <path
                    d="M8 4.5C8.27614 4.5 8.5 4.72386 8.5 5V8.5H11.5C11.7761 8.5 12 8.72386 12 9C12 9.27614 11.7761 9.5 11.5 9.5H8C7.72386 9.5 7.5 9.27614 7.5 9V5C7.5 4.72386 7.72386 4.5 8 4.5Z"
                    fill="currentColor"
                  />
                </svg>`,
                postfix:
                  this.tableViewManager.columnGetDefaultValue(
                    this.column.id
                  ) !== undefined
                    ? html`<span
                        style="color: var(--affine-text-secondary-color); font-size: 12px; margin-left: 4px;"
                      >
                        ${String(
                          this.tableViewManager.columnGetDefaultValue(
                            this.column.id
                          )
                        )}
                      </span>`
                    : undefined,
                select: () => this._setDefaultValue(),
              }),
            ],
          }),
          menu.group({
            items: [
              menu.action({
                name: 'Insert Left Column',
                prefix: InsertLeftIcon(),
                select: () => {
                  this.tableViewManager.propertyAdd({
                    id: this.column.id,
                    before: true,
                  });
                  Promise.resolve()
                    .then(() => {
                      const pre =
                        this.previousElementSibling?.previousElementSibling;
                      if (pre instanceof MobileTableColumnHeader) {
                        pre.editTitle();
                        pre.scrollIntoView({
                          inline: 'nearest',
                          block: 'nearest',
                        });
                      }
                    })
                    .catch(console.error);
                },
              }),
              menu.action({
                name: 'Insert Right Column',
                prefix: InsertRightIcon(),
                select: () => {
                  this.tableViewManager.propertyAdd({
                    id: this.column.id,
                    before: false,
                  });
                  Promise.resolve()
                    .then(() => {
                      const next = this.nextElementSibling?.nextElementSibling;
                      if (next instanceof MobileTableColumnHeader) {
                        next.editTitle();
                        next.scrollIntoView({
                          inline: 'nearest',
                          block: 'nearest',
                        });
                      }
                    })
                    .catch(console.error);
                },
              }),
              menu.action({
                name: 'Move Left',
                prefix: MoveLeftIcon(),
                hide: () => this.column.isFirst,
                select: () => {
                  const preId = this.tableViewManager.propertyPreGet(
                    this.column.id
                  )?.id;
                  if (!preId) {
                    return;
                  }
                  this.tableViewManager.propertyMove(this.column.id, {
                    id: preId,
                    before: true,
                  });
                },
              }),
              menu.action({
                name: 'Move Right',
                prefix: MoveRightIcon(),
                hide: () => this.column.isLast,
                select: () => {
                  const nextId = this.tableViewManager.propertyNextGet(
                    this.column.id
                  )?.id;
                  if (!nextId) {
                    return;
                  }
                  this.tableViewManager.propertyMove(this.column.id, {
                    id: nextId,
                    before: false,
                  });
                },
              }),
            ],
          }),
          menu.group({
            items: [
              menu.action({
                name: 'Duplicate',
                prefix: DuplicateIcon(),
                hide: () => !this.column.canDuplicate,
                select: () => {
                  this.column.duplicate?.();
                },
              }),
              menu.action({
                name: 'Delete',
                prefix: DeleteIcon(),
                hide: () => !this.column.canDelete,
                select: () => {
                  this.column.delete?.();
                },
                class: {
                  'delete-item': true,
                },
              }),
            ],
          }),
        ],
      },
    });
  }

  override render() {
    const column = this.column;
    const style = styleMap({
      height: DEFAULT_COLUMN_TITLE_HEIGHT + 'px',
    });
    return html`
      <div
        style=${style}
        class="mobile-table-column-header"
        @click="${this._clickColumn}"
      >
        <uni-lit
          class="mobile-table-column-header-icon"
          .uni="${column.icon}"
        ></uni-lit>
        <div class="mobile-table-column-header-name">${column.name$.value}</div>
      </div>
    `;
  }

  @property({ attribute: false })
  accessor column!: TableColumn;

  @property({ attribute: false })
  accessor tableViewManager!: TableSingleView;
}

function numberFormatConfig(column: Property): MenuConfig {
  return () =>
    html` <affine-database-number-format-bar
      .column="${column}"
    ></affine-database-number-format-bar>`;
}

declare global {
  interface HTMLElementTagNameMap {
    'mobile-table-column-header': MobileTableColumnHeader;
  }
}

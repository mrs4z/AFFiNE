import {
  menu,
  type MenuConfig,
  popMenu,
  popupTargetFromElement,
} from '@blocksuite/affine-components/context-menu';
import { ShadowlessElement } from '@blocksuite/block-std';
import { SignalWatcher, WithDisposable } from '@blocksuite/global/lit';
import {
  DeleteIcon,
  DuplicateIcon,
  FilterIcon,
  InsertLeftIcon,
  InsertRightIcon,
  MoveLeftIcon,
  MoveRightIcon,
  SortIcon,
  ViewIcon,
} from '@blocksuite/icons/lit';
import { css } from 'lit';
import { property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { createRef, ref } from 'lit/directives/ref.js';
import { styleMap } from 'lit/directives/style-map.js';
import { html } from 'lit/static-html.js';

import {
  inputConfig,
  typeConfig,
} from '../../../../core/common/property-menu.js';
import { filterTraitKey } from '../../../../core/filter/trait.js';
import { firstFilterByRef } from '../../../../core/filter/utils.js';
import { renderUniLit } from '../../../../core/index.js';
import { sortTraitKey } from '../../../../core/sort/manager.js';
import { createSortUtils } from '../../../../core/sort/utils.js';
import {
  draggable,
  dragHandler,
  droppable,
} from '../../../../core/utils/wc-dnd/dnd-context.js';
import type { Property } from '../../../../core/view-manager/property.js';
import { numberFormats } from '../../../../property-presets/number/utils/formats.js';
import { ShowQuickSettingBarContextKey } from '../../../../widget-presets/quick-setting-bar/context.js';
import { DEFAULT_COLUMN_TITLE_HEIGHT } from '../../consts.js';
import type { TableColumn, TableSingleView } from '../../table-view-manager.js';
import {
  getTableGroupRect,
  getVerticalIndicator,
  startDragWidthAdjustmentBar,
} from './vertical-indicator.js';

export class DatabaseHeaderColumn extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  static override styles = css`
    affine-database-header-column {
      display: flex;
    }

    .affine-database-header-column-grabbing * {
      cursor: grabbing;
    }
  `;

  private readonly _clickColumn = () => {
    if (this.tableViewManager.readonly$.value) {
      return;
    }
    this.popMenu();
  };

  private readonly _clickTypeIcon = (event: MouseEvent) => {
    if (this.tableViewManager.readonly$.value) {
      return;
    }
    if (this.column.type$.value === 'title') {
      return;
    }
    event.stopPropagation();
    popMenu(popupTargetFromElement(this), {
      options: {
        items: this.tableViewManager.propertyMetas$.value.map(config => {
          return menu.action({
            name: config.config.name,
            isSelected: config.type === this.column.type$.value,
            prefix: renderUniLit(
              this.tableViewManager.propertyIconGet(config.type)
            ),
            select: () => {
              this.column.typeSet?.(config.type);
            },
          });
        }),
      },
    });
  };

  private readonly _contextMenu = (e: MouseEvent) => {
    if (this.tableViewManager.readonly$.value) {
      return;
    }
    e.preventDefault();
    this.popMenu(e.currentTarget as HTMLElement);
  };

  private readonly _enterWidthDragBar = () => {
    if (this.tableViewManager.readonly$.value) {
      return;
    }
    if (this.drawWidthDragBarTask) {
      cancelAnimationFrame(this.drawWidthDragBarTask);
      this.drawWidthDragBarTask = 0;
    }
    this.drawWidthDragBar();
  };

  private readonly _leaveWidthDragBar = () => {
    cancelAnimationFrame(this.drawWidthDragBarTask);
    this.drawWidthDragBarTask = 0;
    getVerticalIndicator().remove();
  };

  private readonly drawWidthDragBar = () => {
    const rect = getTableGroupRect(this);
    if (!rect) {
      return;
    }
    getVerticalIndicator().display(
      this.getBoundingClientRect().right,
      rect.top,
      rect.bottom - rect.top
    );
    this.drawWidthDragBarTask = requestAnimationFrame(this.drawWidthDragBar);
  };

  private drawWidthDragBarTask = 0;

  private readonly widthDragBar = createRef();

  editTitle = () => {
    this._clickColumn();
  };

  private get readonly() {
    return this.tableViewManager.readonly$.value;
  }

  private _addFilter() {
    const filterTrait = this.tableViewManager.traitGet(filterTraitKey);
    if (!filterTrait) return;

    const filter = firstFilterByRef(this.tableViewManager.vars$.value, {
      type: 'ref',
      name: this.column.id,
    });

    filterTrait.filterSet({
      type: 'group',
      op: 'and',
      conditions: [filter, ...filterTrait.filter$.value.conditions],
    });

    this._toggleQuickSettingBar();
  }

  private _addSort(desc: boolean) {
    const sortTrait = this.tableViewManager.traitGet(sortTraitKey);
    if (!sortTrait) return;

    const sortUtils = createSortUtils(
      sortTrait,
      this.closest('affine-data-view-renderer')?.view?.eventTrace ?? (() => {})
    );
    const sortList = sortUtils.sortList$.value;
    const existingIndex = sortList.findIndex(
      sort => sort.ref.name === this.column.id
    );

    if (existingIndex !== -1) {
      sortUtils.change(existingIndex, {
        ref: { type: 'ref', name: this.column.id },
        desc,
      });
    } else {
      sortUtils.add({
        ref: { type: 'ref', name: this.column.id },
        desc,
      });
    }

    this._toggleQuickSettingBar();
  }

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
    } else if (propertyType === 'select' || propertyType === 'multiSelect') {
      // Для select/multiSelect используем динамический список тегов
      inputConfig = menu.dynamic(() => {
        const options = column.data$.value?.options || [];
        if (!Array.isArray(options) || options.length === 0) {
          return [
            menu.action({
              name: 'No tags available',
              select: () => {},
            }),
          ];
        }

        return options.map(
          (option: { id: string; value: string; color: string }) => {
            return menu.action({
              name: option.value,
              isSelected: currentDefaultValue === option.id,
              prefix: html`
                <div
                  style="
                  background-color: ${option.color};
                  border-radius: 4px;
                  padding: 2px 8px;
                  color: white;
                  font-size: 12px;
                  margin-right: 4px;
                "
                >
                  ${option.value}
                </div>
              `,
              select: () => {
                this.tableViewManager.columnSetDefaultValue(
                  column.id,
                  option.id
                );
              },
            });
          }
        );
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
          onBack: () => {
            // Возвращаемся к основному меню
            this.popMenu();
          },
        },
        items: [
          inputConfig,
          menu.action({
            name:
              currentDefaultValue !== undefined
                ? `Current: ${String(
                    propertyType === 'select' || propertyType === 'multiSelect'
                      ? (Array.isArray(column.data$.value?.options)
                          ? column.data$.value?.options.find(
                              (opt: { id: string }) =>
                                opt.id === currentDefaultValue
                            )?.value
                          : undefined) || currentDefaultValue
                      : currentDefaultValue
                  )}`
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

  private _toggleQuickSettingBar(show = true) {
    const map = this.tableViewManager.contextGet(ShowQuickSettingBarContextKey);
    map.value = {
      ...map.value,
      [this.tableViewManager.id]: show,
    };
  }

  private popMenu(ele?: HTMLElement) {
    const enableNumberFormatting =
      this.tableViewManager.featureFlags$.value.enable_number_formatting;

    popMenu(popupTargetFromElement(ele ?? this), {
      options: {
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
                name: 'Filter',
                prefix: FilterIcon(),
                select: () => this._addFilter(),
              }),
              menu.action({
                name: 'Sort Ascending',
                prefix: SortIcon(),
                select: () => this._addSort(false),
              }),
              menu.action({
                name: 'Sort Descending',
                prefix: SortIcon(),
                select: () => this._addSort(true),
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
                      if (pre instanceof DatabaseHeaderColumn) {
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
                      if (next instanceof DatabaseHeaderColumn) {
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

  private widthDragStart(event: PointerEvent) {
    startDragWidthAdjustmentBar(
      event,
      this,
      this.getBoundingClientRect().width,
      this.column
    );
  }

  override connectedCallback() {
    super.connectedCallback();
    const table = this.closest('affine-database-table');
    if (table) {
      this.disposables.add(
        table.props.handleEvent('dragStart', context => {
          if (this.tableViewManager.readonly$.value) {
            return;
          }
          const event = context.get('pointerState').raw;
          const target = event.target;
          if (
            target instanceof Element &&
            this.widthDragBar.value?.contains(target)
          ) {
            event.preventDefault();
            event.stopPropagation();
            this.widthDragStart(event);
            return true;
          }
          return false;
        })
      );
    }
  }

  override render() {
    const column = this.column;
    const style = styleMap({
      height: DEFAULT_COLUMN_TITLE_HEIGHT + 'px',
    });
    const classes = classMap({
      'affine-database-column-move': true,
      [this.grabStatus]: true,
    });
    return html`
      <div
        style=${style}
        class="affine-database-column-content"
        @click="${this._clickColumn}"
        @contextmenu="${this._contextMenu}"
        ${dragHandler(column.id)}
        ${draggable(column.id)}
        ${droppable(column.id)}
      >
        ${this.readonly
          ? null
          : html` <button class="${classes}">
              <div class="hover-trigger"></div>
              <div class="control-h"></div>
              <div class="control-l"></div>
              <div class="control-r"></div>
            </button>`}
        <div class="affine-database-column-text ${column.type$.value}">
          <div
            class="affine-database-column-type-icon dv-hover"
            @click="${this._clickTypeIcon}"
          >
            <uni-lit .uni="${column.icon}"></uni-lit>
          </div>
          <div class="affine-database-column-text-content">
            <div class="affine-database-column-text-input">
              ${column.name$.value}
            </div>
          </div>
        </div>
      </div>
      <div
        ${ref(this.widthDragBar)}
        @mouseenter="${this._enterWidthDragBar}"
        @mouseleave="${this._leaveWidthDragBar}"
        style="width: 0;position: relative;height: 100%;z-index: 1;cursor: col-resize"
      >
        <div style="width: 8px;height: 100%;margin-left: -4px;"></div>
      </div>
    `;
  }

  @property({ attribute: false })
  accessor column!: TableColumn;

  @property({ attribute: false })
  accessor grabStatus: 'grabStart' | 'grabEnd' | 'grabbing' = 'grabEnd';

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
    'affine-database-header-column': DatabaseHeaderColumn;
  }
}

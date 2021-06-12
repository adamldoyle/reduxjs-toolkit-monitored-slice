import { Story, Meta } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { Provider, useDispatch, useSelector } from 'react-redux';
import {
  PayloadAction,
  configureStore,
  createSlice,
  SliceCaseReducers,
  createSelector,
} from '@reduxjs/toolkit';
import { createMonitoredSlice, IMonitoredState } from './';

interface IWidget {
  id: string;
  factoryId: number;
  name: string;
}

interface IWidgetsState extends IMonitoredState<IWidget[]> {
  selected: string | null;
}

interface IFactoryState {
  factoryId: number | null;
}

interface IRootState {
  widgetsSlice: IWidgetsState;
  factorySlice: IFactoryState;
}

const factorySlice = createSlice<
  IFactoryState,
  SliceCaseReducers<IFactoryState>
>({
  name: 'factorySlice',
  initialState: {
    factoryId: null,
  },
  reducers: {
    selectFactory: (state, action: PayloadAction<number>) => {
      state.factoryId = action.payload;
    },
  },
});

const selectedFactory = createSelector<
  IRootState,
  IFactoryState,
  number | null
>(
  (state) => state.factorySlice,
  (slice) => slice.factoryId
);

const widgetsSlice = createMonitoredSlice<
  IRootState,
  IWidget[],
  IWidgetsState,
  number | null
>(
  {
    name: 'widgetsSlice',
    /** Extra state */
    initialState: {
      selected: null,
    },
    /** Extra reducers */
    reducers: {
      selectWidget: (state, action: PayloadAction<string>) => {
        state.selected = action.payload;
      },
    },
    resetOnStale: false, // Reset to initial data immediately whenever stale prior to loading
    resetOnLoading: true, // Return initial data as data whenever actively loading
  },
  /**
   * Initial data value and what's used when stale/loading depending on resetOnStale/resetOnLoading
   */
  [],
  /**
   * Loader function which loads widgets based on configured param (factoryId)
   * @param factoryId Param provided by loaderParamsSelector
   * @returns Promise with loaded data
   */
  async (factoryId) => {
    action('load')(factoryId);
    if (!factoryId) {
      return Promise.resolve([]);
    }
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([
          {
            factoryId,
            id: `1-${factoryId}`,
            name: `Widget 1 - Factory ${factoryId}`,
          },
          {
            factoryId,
            id: `2-${factoryId}`,
            name: `Widget 2 - Factory ${factoryId}`,
          },
        ]);
      }, 1000);
    });
  },
  /**
   * Selector to use for loading params
   */
  selectedFactory
);

const selectedWidget = createSelector<IRootState, IWidgetsState, string | null>(
  (state) => state.widgetsSlice,
  (slice) => slice.selected
);

const store = configureStore({
  reducer: {
    widgetsSlice: widgetsSlice.slice.reducer,
    factorySlice: factorySlice.reducer,
  },
});

/**
 * Purely a display component with no direct data loading
 * @param param0
 * @returns
 */
function DisplayComponent({
  title,
  factoryId,
  changeFactory,
  loading,
  makeStale,
  data,
  selectedWidgetId,
  selectWidget,
}: {
  title: string;
  factoryId: number;
  changeFactory: () => void;
  loading: boolean;
  makeStale: () => void;
  data: IWidget[];
  selectedWidgetId: string | null;
  selectWidget: (widgetId: string) => void;
}) {
  return (
    <>
      <h1>Widgets - {title}</h1>
      <p>Widgets will automatically load based on selected factory in store.</p>
      <div>
        <h2>
          Current factory: {factoryId ?? 'None'}{' '}
          <button onClick={changeFactory}>Change factory</button>
        </h2>
      </div>
      {loading && <h2>Loading...</h2>}
      {!loading && (
        <>
          <button onClick={makeStale}>Reload widgets - make stale</button>
          <ul>
            {data.map((widget) => (
              <li key={widget.id} onClick={() => selectWidget(widget.id)}>
                {JSON.stringify(widget, null, 4)}
                {widget.id === selectedWidgetId && <> - Selected</>}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

/**
 * This version gets all widget data from the slice's provided hook.
 * @returns sample information
 */
function ComponentUsingHook() {
  const dispatch = useDispatch();
  const factoryId = useSelector(selectedFactory);
  const selectedWidgetId = useSelector(selectedWidget);
  const { data, loading, makeStale } = widgetsSlice.hooks.useMonitoredData();

  const changeFactory = () => {
    const newFactoryId = (factoryId ?? 0) + 1;
    dispatch(factorySlice.actions.selectFactory(newFactoryId));
  };

  const selectWidget = (widgetId: string) => {
    dispatch(widgetsSlice.slice.actions.selectWidget(widgetId));
  };

  return (
    <DisplayComponent
      title="via hook"
      factoryId={factoryId}
      changeFactory={changeFactory}
      loading={loading}
      makeStale={makeStale}
      data={data}
      selectedWidgetId={selectedWidgetId}
      selectWidget={selectWidget}
    />
  );
}

interface ComponentUsingSelectorsProps {
  monitorSlice: boolean;
}

function MonitorSliceComponent() {
  widgetsSlice.hooks.useMonitoredData();
  return null;
}

/**
 * This version gets all widget data from selectors which allows displaying
 * the data without actively monitoring it.
 * @returns sample information
 */
function ComponentUsingSelectors({
  monitorSlice,
}: ComponentUsingSelectorsProps) {
  const dispatch = useDispatch();
  const factoryId = useSelector(selectedFactory);
  const loading = useSelector(widgetsSlice.selectors.selectLoading);
  const data = useSelector(widgetsSlice.selectors.selectData);
  const selectedWidgetId = useSelector(selectedWidget);

  const makeStale = () => {
    dispatch(widgetsSlice.slice.actions.makeStale(null));
  };

  const changeFactory = () => {
    const newFactoryId = (factoryId ?? 0) + 1;
    dispatch(factorySlice.actions.selectFactory(newFactoryId));
  };

  const selectWidget = (widgetId: string) => {
    dispatch(widgetsSlice.slice.actions.selectWidget(widgetId));
  };

  return (
    <>
      {monitorSlice && <MonitorSliceComponent />}
      {!monitorSlice && (
        <p>
          Slice not being monitored and won't load data - toggle via Storybook
          control
        </p>
      )}
      <DisplayComponent
        title="via selectors"
        factoryId={factoryId}
        changeFactory={changeFactory}
        loading={loading}
        makeStale={makeStale}
        data={data}
        selectedWidgetId={selectedWidgetId}
        selectWidget={selectWidget}
      />
    </>
  );
}

export default {
  title: 'MonitoredSlice',
  argTypes: {},
  decorators: [
    (Story) => (
      <Provider store={store}>
        <Story />
      </Provider>
    ),
  ],
} as Meta;

const UsingHookTemplate: Story = () => <ComponentUsingHook />;

export const UsingHook = UsingHookTemplate.bind({});
UsingHook.args = {};

const UsingSelectorsTemplate: Story<ComponentUsingSelectorsProps> = (args) => (
  <ComponentUsingSelectors {...args} />
);

export const UsingSelectors = UsingSelectorsTemplate.bind({});
UsingSelectors.args = {
  monitorSlice: false,
};

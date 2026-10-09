import { a11yProblems } from './a11y';

const press = () => undefined;
const node = (props: Record<string, unknown>) => ({
  type: 'View',
  props: { onClick: press, ...props },
});

describe('a11y helper', () => {
  it('flags missing roles and labels and small targets, and counts hitSlop', () => {
    const tree = {
      type: 'View',
      props: {},
      children: [
        'text',
        node({
          testID: 'ok',
          accessibilityRole: 'button',
          accessibilityLabel: 'Ok',
          style: { minHeight: 44, minWidth: 44 },
        }),
        node({ testID: 'bare', style: { height: 44, width: 44 } }),
        node({
          testID: 'small',
          accessibilityRole: 'button',
          accessibilityLabel: 'Small',
          style: { height: 24, width: 24 },
        }),
        node({
          testID: 'slop',
          accessibilityRole: 'button',
          accessibilityLabel: 'Slop',
          style: { height: 24, width: 24 },
          hitSlop: 10,
        }),
        node({
          accessibilityRole: 'button',
          accessibilityLabel: 'Edges',
          style: [{ height: 30 }, { width: 30 }],
          hitSlop: { top: 7, bottom: 7, left: 7, right: 7 },
        }),
        node({}),
      ],
    };
    expect(a11yProblems(tree)).toEqual([
      'bare: no accessibilityRole',
      'bare: no accessibilityLabel',
      'small: touch target 24×24 < 44×44',
      '(unnamed): no accessibilityRole',
      '(unnamed): no accessibilityLabel',
      '(unnamed): touch target 0×0 < 44×44',
    ]);
  });
});

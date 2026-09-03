// ── Cart Store (React Context) ────────────────────────────────────────────
import React, { createContext, useContext, useReducer } from 'react';

export interface CartItem {
  id: number;
  name: string;
  emoji: string;
  img: string | null;
  price: number;
  unit: string;
  qty: number;
}

interface CartState {
  items: CartItem[];
  total: number;
  count: number;
}

type CartAction =
  | { type: 'ADD'; item: Omit<CartItem, 'qty'> }
  | { type: 'REMOVE'; id: number }
  | { type: 'INCREMENT'; id: number }
  | { type: 'DECREMENT'; id: number }
  | { type: 'CLEAR' };

function cartReducer(state: CartState, action: CartAction): CartState {
  let items: CartItem[];
  switch (action.type) {
    case 'ADD':
      const existing = state.items.find(i => i.id === action.item.id);
      if (existing) {
        items = state.items.map(i => i.id === action.item.id ? { ...i, qty: i.qty + 1 } : i);
      } else {
        items = [...state.items, { ...action.item, qty: 1 }];
      }
      break;
    case 'REMOVE':
      items = state.items.filter(i => i.id !== action.id);
      break;
    case 'INCREMENT':
      items = state.items.map(i => i.id === action.id ? { ...i, qty: i.qty + 1 } : i);
      break;
    case 'DECREMENT':
      items = state.items.map(i => i.id === action.id ? { ...i, qty: Math.max(1, i.qty - 1) } : i);
      break;
    case 'CLEAR':
      items = [];
      break;
    default:
      items = state.items;
  }
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  const count = items.reduce((s, i) => s + i.qty, 0);
  return { items, total, count };
}

const CartContext = createContext<{ state: CartState; dispatch: React.Dispatch<CartAction> }>(
  {} as any
);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(cartReducer, { items: [], total: 0, count: 0 });
  return <CartContext.Provider value={{ state, dispatch }}>{children}</CartContext.Provider>;
};

export const useCart = () => useContext(CartContext);

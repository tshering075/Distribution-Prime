import { render, screen } from "@testing-library/react";
import App from "./App";

// CRA Jest often fails to resolve react-router-dom v7; smoke-test the app shell only.
jest.mock("./layout/AppRouter", () => ({
  __esModule: true,
  default: function MockAppRouter() {
    return (
      <div data-testid="app-shell">
        <span>CokeSales Management System</span>
      </div>
    );
  },
}));

test("App mounts without throwing", () => {
  expect(() => render(<App />)).not.toThrow();
  expect(screen.getByTestId("app-shell")).toBeInTheDocument();
  expect(screen.getByText(/CokeSales Management System/i)).toBeInTheDocument();
});

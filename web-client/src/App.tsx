import { RouterProvider } from "react-router-dom";
import { router } from "./app/routes/router";
import { ToastProvider } from "./app/providers/toast";

export default function App() {
  return (
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  );
}

import tkinter as tk
from tkinter import ttk, messagebox, filedialog, colorchooser
import pandas as pd
import math
import matplotlib.pyplot as plt
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
import os
import sys

# --- CONFIGURATION ---
# We use just the filenames here. The script will look for them in the same folder as the script.
FILENAME_LEFT = 'אריק_איינשטיין.csv'
FILENAME_RIGHT = 'זוהר_ארגוב (1).csv'

class ButterflyApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Studio 1: Data Weaver - Kings Butterfly 3.1 (Fix)")
        self.root.geometry("1600x950")

        # --- PATH SETUP ---
        # Get the directory where this script is located
        if getattr(sys, 'frozen', False):
            self.script_dir = os.path.dirname(sys.executable)
        else:
            self.script_dir = os.path.dirname(os.path.abspath(__file__))

        # Construct initial full paths
        init_left = os.path.join(self.script_dir, FILENAME_LEFT)
        init_right = os.path.join(self.script_dir, FILENAME_RIGHT)

        # --- STATE VARIABLES ---
        self.file_path_left = tk.StringVar(value=init_left)
        self.file_path_right = tk.StringVar(value=init_right)
        
        self.color_left = "#0000FF" # Blue
        self.color_right = "#FF0000" # Red
        
        self.data_left = []
        self.data_right = []

        self.sort_options = {
            "Popularity (High to Low)": ('popularity', True),
            "Duration (Short to Long)": ('duration_ms', False),
            "Duration (Long to Short)": ('duration_ms', True),
            "Energy (Low to High)": ('energy', False),
            "Energy (High to Low)": ('energy', True),
            "Happy/Sad (Valence)": ('valence', True),
            "Year (Old to New)": ('year', False)
        }
        self.current_sort = tk.StringVar(value="Popularity (High to Low)")

        # --- LAYOUT ---
        main_paned = tk.PanedWindow(root, orient=tk.HORIZONTAL)
        main_paned.pack(fill=tk.BOTH, expand=True)

        # 1. Controls (Left)
        self.frame_controls = tk.Frame(main_paned, width=350, padx=10, pady=10, bg="#f5f5f5")
        main_paned.add(self.frame_controls, minsize=350)
        
        # 2. Preview (Right)
        self.frame_preview = tk.Frame(main_paned, bg="white")
        main_paned.add(self.frame_preview, stretch="always")

        # --- NOTEBOOK ---
        self.notebook = ttk.Notebook(self.frame_controls)
        self.notebook.pack(fill=tk.BOTH, expand=True, pady=5)

        self.tab_data = tk.Frame(self.notebook, bg="#f5f5f5", padx=10, pady=10)
        self.tab_visuals = tk.Frame(self.notebook, bg="#f5f5f5", padx=10, pady=10)
        
        self.notebook.add(self.tab_data, text="📂 Data & Files")
        self.notebook.add(self.tab_visuals, text="🎨 Style & Param")

        # --- CONTROLS SETUP ---
        self.setup_data_tab()
        self.setup_visual_tab()

        # --- BOTTOM ACTIONS ---
        frame_actions = tk.Frame(self.frame_controls, bg="#f5f5f5")
        frame_actions.pack(side=tk.BOTTOM, fill=tk.X, pady=10)
        
        self.lbl_status = tk.Label(frame_actions, text="Ready", bd=1, relief=tk.SUNKEN, anchor=tk.W, bg="#e0e0e0")
        self.lbl_status.pack(side=tk.BOTTOM, fill=tk.X)

        tk.Button(frame_actions, text="🔄 REFRESH PLOT", command=self.refresh_all, 
                  bg="#cccccc", height=2).pack(fill=tk.X, pady=5)
        
        tk.Button(frame_actions, text="💾 EXPORT SVG", command=self.export_svg, 
                  bg="black", fg="white", font=("Arial", 11, "bold"), height=3).pack(fill=tk.X, pady=5)

        # --- MATPLOTLIB ---
        self.fig, self.ax = plt.subplots(figsize=(10, 8))
        self.canvas = FigureCanvasTkAgg(self.fig, master=self.frame_preview)
        self.canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)

        # Initial Load
        self.root.after(100, self.refresh_all) # Small delay to ensure UI is ready

    def setup_data_tab(self):
        self.add_header(self.tab_data, "LEFT SIDE (Artist A)")
        self.lbl_file_left = tk.Label(self.tab_data, text="...", bg="#ddd", anchor="w", padx=5, wraplength=250)
        self.lbl_file_left.pack(fill=tk.X, pady=2)
        tk.Button(self.tab_data, text="Browse CSV...", command=lambda: self.browse_file('left')).pack(anchor="e", pady=2)

        self.add_header(self.tab_data, "RIGHT SIDE (Artist B)")
        self.lbl_file_right = tk.Label(self.tab_data, text="...", bg="#ddd", anchor="w", padx=5, wraplength=250)
        self.lbl_file_right.pack(fill=tk.X, pady=2)
        tk.Button(self.tab_data, text="Browse CSV...", command=lambda: self.browse_file('right')).pack(anchor="e", pady=2)

        tk.Frame(self.tab_data, height=1, bg="#ccc").pack(fill=tk.X, pady=15)

        self.add_header(self.tab_data, "SORTING")
        self.combo_sort = ttk.Combobox(self.tab_data, textvariable=self.current_sort, 
                                       values=list(self.sort_options.keys()), state="readonly")
        self.combo_sort.pack(fill=tk.X, pady=5)
        self.combo_sort.bind("<<ComboboxSelected>>", lambda e: self.refresh_all())

    def setup_visual_tab(self):
        self.add_header(self.tab_visuals, "COLORS")
        f_col = tk.Frame(self.tab_visuals, bg="#f5f5f5")
        f_col.pack(fill=tk.X, pady=5)
        self.btn_col_left = tk.Button(f_col, text="Left", bg=self.color_left, fg="white", command=lambda: self.pick_color('left'))
        self.btn_col_left.pack(side=tk.LEFT, expand=True, fill=tk.X, padx=2)
        self.btn_col_right = tk.Button(f_col, text="Right", bg=self.color_right, fg="white", command=lambda: self.pick_color('right'))
        self.btn_col_right.pack(side=tk.LEFT, expand=True, fill=tk.X, padx=2)

        tk.Frame(self.tab_visuals, height=1, bg="#ccc").pack(fill=tk.X, pady=10)

        self.var_songs = self.add_slider(self.tab_visuals, "Top N Songs", 5, 50, 20, 1)
        self.var_width = self.add_slider(self.tab_visuals, "Stroke Width", 0.1, 2.0, 0.5, 0.1)
        self.var_amp = self.add_slider(self.tab_visuals, "Energy (Height)", 1.0, 15.0, 5.0)
        self.var_freq = self.add_slider(self.tab_visuals, "Jitter (Mood)", 0.5, 5.0, 1.2)
        self.var_length = self.add_slider(self.tab_visuals, "Length (Duration)", 50, 200, 130)
        self.var_spacing = self.add_slider(self.tab_visuals, "Spacing", 0.5, 4.0, 1.0)

    # --- HELPERS ---
    def add_header(self, parent, text):
        tk.Label(parent, text=text, font=("Arial", 10, "bold"), bg="#f5f5f5", pady=5).pack(anchor="w")

    def add_slider(self, parent, label, min_val, max_val, default, resolution=0.1):
        tk.Label(parent, text=label, bg="#f5f5f5").pack(anchor="w")
        var = tk.DoubleVar(value=default)
        tk.Scale(parent, variable=var, from_=min_val, to=max_val, orient=tk.HORIZONTAL, resolution=resolution, bg="#f5f5f5", command=lambda x: self.update_plot_only()).pack(fill=tk.X)
        return var

    def fix_hebrew(self, text):
        if not isinstance(text, str): return str(text)
        if any("\u0590" <= c <= "\u05EA" for c in text): return text[::-1]
        return text

    def browse_file(self, side):
        path = filedialog.askopenfilename(initialdir=self.script_dir, filetypes=[("CSV Files", "*.csv")])
        if path:
            if side == 'left': self.file_path_left.set(path)
            else: self.file_path_right.set(path)
            self.refresh_all()

    def pick_color(self, side):
        color = colorchooser.askcolor()[1]
        if color:
            if side == 'left': 
                self.color_left = color
                self.btn_col_left.config(bg=color)
            else: 
                self.color_right = color
                self.btn_col_right.config(bg=color)
            self.update_plot_only()

    # --- CORE LOGIC ---
    def load_data(self, filepath):
        if not filepath or not os.path.exists(filepath):
            return []
        try:
            df = pd.read_csv(filepath)
            df.columns = [c.strip() for c in df.columns] # Clean headers
            
            # Helper to safely get value
            def safe_get(row, col, default, type_func):
                if col not in row: return default
                try: return type_func(row[col])
                except: return default

            songs = []
            for _, row in df.iterrows():
                songs.append({
                    'name': safe_get(row, 'Track Name', 'Unknown', str),
                    'year': str(safe_get(row, 'Release Date', '0000', str)).split('-')[0],
                    'popularity': safe_get(row, 'Popularity', 0, int),
                    'duration_ms': safe_get(row, 'Duration (ms)', 0, int),
                    'valence': safe_get(row, 'Valence', 0.5, float),
                    'energy': safe_get(row, 'Energy', 0.5, float)
                })
            
            # Sort
            key, reverse = self.sort_options[self.current_sort.get()]
            if key == 'year': songs.sort(key=lambda x: int(x['year']) if x['year'].isdigit() else 0, reverse=reverse)
            else: songs.sort(key=lambda x: x[key], reverse=reverse)
            
            return songs
        except Exception as e:
            messagebox.showerror("Data Load Error", f"Failed to load:\n{filepath}\n\nError:\n{e}")
            return []

    def refresh_all(self):
        # Update Labels
        self.lbl_file_left.config(text=os.path.basename(self.file_path_left.get()))
        self.lbl_file_right.config(text=os.path.basename(self.file_path_right.get()))
        
        # Load
        self.data_left = self.load_data(self.file_path_left.get())
        self.data_right = self.load_data(self.file_path_right.get())
        
        # Update Status
        status = f"Status: Left={len(self.data_left)} songs | Right={len(self.data_right)} songs"
        self.lbl_status.config(text=status)
        
        if not self.data_left and not self.data_right:
            self.ax.clear()
            self.ax.text(0.5, 0.5, "NO DATA LOADED\nCheck File Paths", ha='center', va='center')
            self.canvas.draw()
        else:
            self.update_plot_only()

    def get_wave_points(self, x_start, y_base, song, direction):
        max_len = self.var_length.get()
        # Scale: 5 mins = max_len
        line_length = (song['duration_ms'] / 300000) * max_len
        line_length = min(line_length, max_len)
        
        steps = int(line_length * 2)
        if steps < 10: steps = 10
        
        x_pts, y_pts = [], []
        for i in range(steps + 1):
            dist = i * (line_length / steps)
            x = x_start + (dist * direction)
            
            # Taper
            taper = math.sin((i / steps) * math.pi)
            
            # Params
            freq = 0.5 + (song['valence'] * 3.0 * self.var_freq.get())
            amp = (song['energy'] * self.var_amp.get()) * taper
            
            angle = (dist / 10) * (2 * math.pi) * freq
            y_offset = math.sin(angle) * amp
            
            x_pts.append(x)
            y_pts.append(y_base + y_offset)
            
        return x_pts, y_pts, x

    def update_plot_only(self):
        self.ax.clear()
        self.ax.set_axis_off()
        self.ax.axvline(x=0, color='#dddddd', lw=1)
        
        top_n = int(self.var_songs.get())
        spacing = self.var_spacing.get() * 8
        width = self.var_width.get()
        
        # Plot Left
        for i, song in enumerate(self.data_left[:top_n]):
            y = -i * spacing
            x_pts, y_pts, lx = self.get_wave_points(-2, y, song, -1)
            self.ax.plot(x_pts, y_pts, color=self.color_left, lw=width, alpha=0.7)
            self.ax.text(lx - 5, y, self.fix_hebrew(f"{song['name']} ({song['year']})"), ha='right', va='center', fontsize=7, color='grey')

        # Plot Right
        for i, song in enumerate(self.data_right[:top_n]):
            y = -i * spacing
            x_pts, y_pts, lx = self.get_wave_points(2, y, song, 1)
            self.ax.plot(x_pts, y_pts, color=self.color_right, lw=width, alpha=0.7)
            self.ax.text(lx + 5, y, self.fix_hebrew(f"{song['name']} ({song['year']})"), ha='left', va='center', fontsize=7, color='grey')
            
        self.canvas.draw()

    def export_svg(self):
        filename = filedialog.asksaveasfilename(defaultextension=".svg", filetypes=[("SVG", "*.svg")])
        if not filename: return
        
        W_MM, H_MM = 420, 297
        CX, MARGIN = W_MM/2, 40
        top_n = int(self.var_songs.get())
        
        draw_h = H_MM - (2*MARGIN) - 30
        row_h = draw_h / max(top_n, 1)
        
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W_MM}mm" height="{H_MM}mm" viewBox="0 0 {W_MM} {H_MM}">\n')
            f.write(f'<line x1="{CX}" y1="{MARGIN}" x2="{CX}" y2="{MARGIN + draw_h}" stroke="#eee" stroke-width="0.5" />\n')
            
            for i in range(top_n):
                y = MARGIN + (i * row_h) + (row_h/2)
                
                if i < len(self.data_left):
                    s = self.data_left[i]
                    xp, yp, lx = self.get_wave_points(CX-2, y, s, -1)
                    d = "M " + " L ".join([f"{x:.2f},{y:.2f}" for x, y in zip(xp, yp)])
                    f.write(f'<path d="{d}" fill="none" stroke="{self.color_left}" stroke-width="{self.var_width.get()}" />\n')
                    f.write(f'<text x="{lx-5}" y="{y+1}" font-family="Arial" font-size="3" fill="{self.color_left}" text-anchor="end">{self.fix_hebrew(s["name"])}</text>\n')

                if i < len(self.data_right):
                    s = self.data_right[i]
                    xp, yp, lx = self.get_wave_points(CX+2, y, s, 1)
                    d = "M " + " L ".join([f"{x:.2f},{y:.2f}" for x, y in zip(xp, yp)])
                    f.write(f'<path d="{d}" fill="none" stroke="{self.color_right}" stroke-width="{self.var_width.get()}" />\n')
                    f.write(f'<text x="{lx+5}" y="{y+1}" font-family="Arial" font-size="3" fill="{self.color_right}" text-anchor="start">{self.fix_hebrew(s["name"])}</text>\n')

            f.write('</svg>')
        messagebox.showinfo("Export", f"Saved to {filename}")

if __name__ == "__main__":
    root = tk.Tk()
    app = ButterflyApp(root)
    root.mainloop()
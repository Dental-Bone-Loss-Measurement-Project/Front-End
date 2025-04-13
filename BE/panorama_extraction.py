import SimpleITK as sitk
import numpy as np
import matplotlib.pyplot as plt
from tkinter import Tk, filedialog
from skimage.filters import threshold_otsu
from skimage.filters import threshold_otsu, threshold_local
from scipy.ndimage import binary_closing
import cv2
from scipy.signal import find_peaks
from scipy.optimize import curve_fit
from skimage.morphology import opening, disk
from scipy.ndimage import gaussian_filter1d
from skimage import measure
from skimage.morphology import skeletonize, remove_small_objects
from scipy.interpolate import splprep, splev
from scipy.ndimage import distance_transform_edt

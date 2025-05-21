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

def generate_coronal_mip(cbct_array):
    coronal_mip = np.max(cbct_array, axis=1)  # Maximum intensity projection along coronal axis
    return coronal_mip

# Gaussian function
def gaussian(x, a, mean, std_dev):
    return a * np.exp( -((x - mean) ** 2) / (2 * std_dev ** 2))

# Preprocess the histogram to exclude spikes
def preprocess_histogram(hist, bin_centers, spike_threshold=0.05):
    # Compute the gradient to detect sudden spikes
    grad = np.gradient(hist)
    valid_mask = (grad < spike_threshold * np.max(grad))  # Exclude bins with steep gradients
    filtered_hist = hist * valid_mask
    return filtered_hist, valid_mask

# Detect and Fit Gaussian to Largest Valid Peak
def detect_and_fit_largest_valid_peak(hist, bin_centers, peak_width=20, intensity_cutoff=0.95):
    # Step 1: Filter out high-intensity spikes
    valid_intensity_mask = bin_centers < intensity_cutoff * np.max(bin_centers)
    filtered_hist = hist * valid_intensity_mask

    # Step 2: Detect peaks in the filtered histogram
    peaks, _ = find_peaks(filtered_hist, height=np.mean(filtered_hist) * 1.5)  # Detect meaningful peaks
    if len(peaks) == 0:
        raise ValueError("No valid peaks detected after filtering the histogram!")

    # Step 3: Identify the peak with the highest gray value
    largest_gray_value_peak = peaks[np.argmax(bin_centers[peaks])]

    # Step 4: Define the range for Gaussian fitting
    peak_center = bin_centers[largest_gray_value_peak]
    fit_mask = (bin_centers >= peak_center - peak_width) & (bin_centers <= peak_center + peak_width)

    try:
        # Step 5: Perform Gaussian fitting
        p0 = [hist[largest_gray_value_peak], peak_center, 10]  # Initial guess
        popt, _ = curve_fit(gaussian, bin_centers[fit_mask], hist[fit_mask], p0=p0)
        a, mean, std_dev = popt

        # Step 6: Calculate the threshold
        threshold = mean + 1.98 * std_dev

        return mean, std_dev, threshold
    except RuntimeError:
        print("Gaussian fitting failed. Falling back to alternative thresholding...")
        # Example fallback
        threshold = np.percentile(bin_centers, 95)
        return None, None, threshold

def compute_axial_indices_and_plot(binary_mask, coronal_mip):
    # Step 1: Compute the Y-Histogram
    y_hist = np.sum(binary_mask, axis=1)  # Project along Y-axis
    y_axis = np.arange(len(y_hist))  # Y-axis positions

    # Step 2: Detect Peaks in Y-Histogram
    peaks, properties = find_peaks(y_hist, height=np.max(y_hist) * 0.5)  # Peaks > 50% max height
    if len(peaks) == 0:
        raise ValueError("No peaks detected in the Y-Histogram!")

    # Identify the highest peak
    highest_peak_idx = peaks[np.argmax(y_hist[peaks])]
    highest_peak_value = y_hist[highest_peak_idx]

    # Step 3: Fit Gaussian to the Highest Peak
    peak_width = 50  # Region around the highest peak for fitting
    fit_mask = (y_axis >= highest_peak_idx - peak_width) & (y_axis <= highest_peak_idx + peak_width)

    # Perform Gaussian fitting
    p0 = [highest_peak_value, highest_peak_idx, 10]  # Initial guess: amplitude, mean, std_dev
    popt, _ = curve_fit(gaussian, y_axis[fit_mask], y_hist[fit_mask], p0=p0)
    a, mean_t, std_dev_t = popt

    # Compute the width (w)
    w = 3 * std_dev_t

    # Step 4: Determine Slice Range

    if len(peaks) >= 2:
        # Get the indices of the two highest peaks
        sorted_peaks = peaks[np.argsort(y_hist[peaks])[::-1]]
        Eb, Et = sorted_peaks[:2]  # Two highest peaks
 
        # Ensure Eb is the lower peak and Et is the upper peak
        Eb, Et = min(Eb, Et), max(Eb, Et)
        print("Eb:",Eb)
        print("Et:",Et)
        # Compute slice range
        axial_start_index = abs(int(Eb - 2.5 * w ))
        axial_end_index = abs(int(Et + 1.5 * w ))
    else:
        axial_start_index = abs(int(mean_t - 2.5 * w ))
        axial_end_index = abs(int(mean_t + 1.5 * w ))

    return axial_start_index, axial_end_index


def generate_axial_mip(cbct_array, lower_bound, upper_bound):
    axial_range = cbct_array[lower_bound:upper_bound]
    axial_mip = np.max(axial_range, axis=0)  # Maximum intensity projection along axial view
    return axial_mip

# Complete Pipeline
def process_cbct(cbct_array):
    # Step 1: Coronal MIP
    coronal_mip = generate_coronal_mip(cbct_array)
    #compute histogram
    hist, bin_edges = np.histogram(coronal_mip[coronal_mip > 0], bins=256)
    bin_centers = (bin_edges[:-1] + bin_edges[1:]) / 2

    # Detect and Fit Gaussian for Largest Valid Peak
    # Apply updated method to detect and fit the peak
    mean, std_dev, threshold = detect_and_fit_largest_valid_peak(hist, bin_centers)
    print(f"Mean (μ): {mean}")
    print(f"Standard Deviation (σ): {std_dev}")
    print(f"Threshold (T): {threshold}")

    # Create the binary mask by thresholding the image
    binary_mask = coronal_mip > threshold
    print(threshold)
    # Post-processing: Morphological operations to remove small noise
    binary_mask = opening(binary_mask, disk(7))  # Remove small noise with morphological operations

    plt.imshow(binary_mask, cmap = 'gray')
    
    # Step 4: Slice Bounds
    axial_start, axial_end = compute_axial_indices_and_plot(binary_mask, coronal_mip)
    print(f"Axial Start Index: {axial_start}")
    print(f"Axial End Index: {axial_end}")
    
    # Step 4: Axial MIP
    axial_mip = generate_axial_mip(cbct_array, axial_start, axial_end)

    return axial_mip

def process_jaws_and_teeth(binary_mask_axial):
    # Step 1: Morphological Operations to clean the binary mask
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (27, 27))
    cleaned_mask = cv2.morphologyEx(binary_mask_axial, cv2.MORPH_OPEN, kernel)
    cleaned_mask = cv2.morphologyEx(cleaned_mask, cv2.MORPH_OPEN, kernel)

  

    # Step 2: Find contours
    contours, _ = cv2.findContours(cleaned_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    # Step 3: Identify the largest contour based on the bounding rectangle area
    max_area = 0
    largest_contour = None
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        area = w * h
        if area > max_area:
            max_area = area
            largest_contour = contour

    if largest_contour is None:
        raise ValueError("No valid contours found!")
    # Step 4: Smooth the largest contour using Gaussian smoothing
    smoothed_contour = []
    for i in range(len(largest_contour)):
        x_vals = largest_contour[:, 0, 0]
        y_vals = largest_contour[:, 0, 1]
        smooth_x = gaussian_filter1d(x_vals, sigma=2)
        smooth_y = gaussian_filter1d(y_vals, sigma=2)
        smoothed_contour = np.array([smooth_x, smooth_y]).T.reshape(-1, 1, 2).astype(np.int32)

    # Step 5: Create a new mask for the smoothed contour
    smoothed_mask = np.zeros_like(binary_mask_axial, dtype=np.uint8)
    cv2.drawContours(smoothed_mask, [smoothed_contour], -1, 1, thickness=-1)  # Fill the contour

    return smoothed_mask

# play in thickness for better resolution of teeth also you can play in the stretch factor
def extract_panoramic_view(cbct_data, curve_x, curve_y, thickness=100, stretch_factor=1.5):
    """
    Extract panoramic view with proper stretching and sampling
    """
    depth, height, width = cbct_data.shape

    # Increase number of sampling points horizontally by stretch factor
    num_points = int(len(curve_x) * stretch_factor)
    panoramic = np.zeros((depth, num_points))

    # Resample curve points to match new resolution
    t = np.linspace(0, 1, len(curve_x))
    t_new = np.linspace(0, 1, num_points)
    curve_x_stretched = np.interp(t_new, t, curve_x)
    curve_y_stretched = np.interp(t_new, t, curve_y)

    # Calculate curve derivatives for perpendicular sampling
    dx = np.gradient(curve_x_stretched)
    dy = np.gradient(curve_y_stretched)

    for z in range(depth):
        slice_data = cbct_data[z]

        for i in range(num_points):
            x, y = int(curve_x_stretched[i]), int(curve_y_stretched[i])

            # Calculate perpendicular direction
            normal_x = -dy[i]
            normal_y = dx[i]
            norm = np.sqrt(normal_x**2 + normal_y**2)
            if norm != 0:
                normal_x /= norm
                normal_y /= norm

            # Sample along perpendicular line with more points
            samples = []
            for t in range(-thickness // 2, thickness // 2):
                sample_x = int(x + normal_x * t)
                sample_y = int(y + normal_y * t)

                if (0 <= sample_x < width and 0 <= sample_y < height):
                    samples.append(slice_data[sample_y, sample_x])

            if samples:
                # Use maximum intensity projection
                panoramic[z, i] = np.max(samples) # play in this for taking mean or max projection

    return panoramic
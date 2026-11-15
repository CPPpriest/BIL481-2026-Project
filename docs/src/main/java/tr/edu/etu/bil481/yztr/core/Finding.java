package tr.edu.etu.bil481.yztr.core;

public record Finding(String id, PackageId packageId, String category, String severity, String message) {
}
